'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

import {
  requestAccess,
  getNetworkDetails,
} from "@stellar/freighter-api";

import {
  generateZkProof,
  verifyProofLocally,
} from "../lib/zkp";

import {
  getMerkleProof,
  addToMockWhitelist,
} from "../lib/merkle";

import {
  credentialExists,
  createCredential,
  unlockCredential,
} from "../lib/identity";

import { parseContractError } from "../lib/errorMapper";

import { toast } from "react-hot-toast";

import {
  payWithZkGroth16,
  getContractMerkleRoot,
} from "../lib/stellar";

import {
  createPaymentTrace,
  traceStep,
  finalizeTrace,
} from '../lib/telemetry';

import { capturePaymentError } from "../lib/sentryCapture";

import {
  createPendingTx,
  updateTxRecord,
  generateTxId,
  buildExplorerUrl,
  finalizeTxHistory,
} from "../lib/history";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type CredentialStatus =
  | 'unknown'
  | 'exists'
  | 'not_found';

interface ProofProgressState {
  stage: string;
  pct: number;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>(
    (_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(message));
      }, ms);
    },
  );

  return Promise.race([
    promise,
    timeoutPromise,
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export const useFluppy = () => {
  const [walletAddress, setWalletAddress] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [txHash, setTxHash] =
    useState<string | null>(null);

  const [logs, setLogs] =
    useState<string[]>([]);

  const [credentialStatus, setCredentialStatus] =
    useState<CredentialStatus>('unknown');

  const [proofProgress, setProofProgress] =
    useState<ProofProgressState | null>(null);

  const mountedRef = useRef(true);

  const proofAbortRef =
    useRef<AbortController | null>(null);

  // ───────────────────────────────────────────────────────────
  // CLEANUP
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      proofAbortRef.current?.abort();
    };
  }, []);

  // ───────────────────────────────────────────────────────────
  // LOGGING
  // ───────────────────────────────────────────────────────────

  const addLog = useCallback((message: string) => {
    const timestamp =
      new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

    setLogs(prev => [
      ...prev,
      `[${timestamp}] ${message}`,
    ]);
  }, []);

  // ───────────────────────────────────────────────────────────
  // PROGRESS
  // ───────────────────────────────────────────────────────────

  const handleProofProgress = useCallback(
    (
      stage: string,
      pct: number,
    ) => {
      if (!mountedRef.current) {
        return;
      }

      setProofProgress({
        stage,
        pct,
      });
    },
    [],
  );

  // ───────────────────────────────────────────────────────────
  // NETWORK VALIDATION
  // ───────────────────────────────────────────────────────────

  async function validateFreighterNetwork(): Promise<void> {
    const network =
      await getNetworkDetails();

    const expectedPassphrase =
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

    if (!expectedPassphrase) {
      throw new Error(
        'Missing NEXT_PUBLIC_NETWORK_PASSPHRASE',
      );
    }

    if (
      network.networkPassphrase !==
      expectedPassphrase
    ) {
      throw new Error(
        'Freighter network mismatch. Please switch network.',
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // WALLET
  // ───────────────────────────────────────────────────────────

  const connectWallet = async () => {
    try {
      const access =
        await requestAccess();

      if (access.address) {
        setWalletAddress(access.address);

        addLog(
          `Wallet: ${access.address.slice(0, 6)}...${access.address.slice(-4)}`
        );

        toast.success(
          "Wallet Connected"
        );

        await checkCredentialStatus();
      }
    } catch {
      addLog(
        "ERR: Wallet connection failed."
      );

      toast.error(
        "Freighter connection failed."
      );
    }
  };

  // ───────────────────────────────────────────────────────────
  // CREDENTIAL STATUS
  // ───────────────────────────────────────────────────────────

  const checkCredentialStatus =
    useCallback(async () => {
      try {
        const exists =
          await credentialExists();

        setCredentialStatus(
          exists
            ? 'exists'
            : 'not_found'
        );

        addLog(
          `Identity: Credential ${exists ? 'found' : 'not found'}.`
        );

      } catch (err) {
        console.error(
          '[useFluppy] checkCredentialStatus error:',
          err,
        );

        setCredentialStatus(
          'not_found'
        );
      }
    }, [addLog]);

  // ───────────────────────────────────────────────────────────
  // SETUP CREDENTIAL
  // ───────────────────────────────────────────────────────────

  const setupCredential = async (
    password: string,
  ): Promise<string> => {
    try {
      addLog(
        "Identity: Creating new ZK credential..."
      );

      const { secret } =
        await createCredential(password);

      addLog(
        "✓ Credential created successfully"
      );

      return secret;

    } catch (err: unknown) {
      const parsed =
        parseContractError(err);

      addLog(
        `❌ Credential setup failed: ${parsed.userMessage}`
      );

      console.error(err);

      throw err;
    }
  };

  // ───────────────────────────────────────────────────────────
  // EXECUTE PAYMENT
  // ───────────────────────────────────────────────────────────

  const executePayment = async (
    amount: string,
    hotelWallet: string,
    password: string,
  ) => {

    if (!walletAddress) {
      toast.error(
        "Please connect your wallet first"
      );

      return;
    }

    if (!password.trim()) {
      toast.error(
        "Password required to unlock credential"
      );

      return;
    }

    const trace =
      createPaymentTrace();

    const txId =
      generateTxId();

    if (mountedRef.current) {
      setProofProgress(null);
      setLoading(true);
      setTxHash(null);
      setLogs([]);
    }

    try {

      addLog(
        "System: Starting ZK Privacy-Preserving Settlement..."
      );

      // ─────────────────────────────────────────────
      // NETWORK VALIDATION
      // ─────────────────────────────────────────────

      await validateFreighterNetwork();

      // ─────────────────────────────────────────────
      // UNLOCK CREDENTIAL
      // ─────────────────────────────────────────────

      addLog(
        "Identity: Unlocking credential from IndexedDB..."
      );

      traceStep(
        trace,
        'credential:decrypt',
      );

      const secret =
        await unlockCredential(password);

      addLog(
        `Identity: Credential unlocked (${secret.slice(0, 8)}...${secret.slice(-4)})`
      );

      // ─────────────────────────────────────────────
      // AMOUNT
      // ─────────────────────────────────────────────

      const rawAmount =
        BigInt(
          Math.floor(
            parseFloat(amount) * 10_000_000,
          ),
        );

      addLog(
        `Finance: ${amount} USDC = ${rawAmount} stroops`
      );

      // ─────────────────────────────────────────────
      // WHITELIST
      // ─────────────────────────────────────────────

      await addToMockWhitelist(secret);

      addLog(
        "Merkle: Secret registered to whitelist (mock mode)."
      );

      // ─────────────────────────────────────────────
      // MERKLE PROOF
      // ─────────────────────────────────────────────

      addLog(
        "Merkle: Fetching membership proof..."
      );

      traceStep(
        trace,
        'merkle:request',
      );

      const merkleProof =
        await getMerkleProof(secret);

      const contractRoot =
        await getContractMerkleRoot();

      const frontendRoot = merkleProof.root
        .toString(16)
        .padStart(64, '0')
        .toLowerCase();

      if (contractRoot.toLowerCase() !== frontendRoot) {
        console.info('[DEV] Latest frontend root hex:', frontendRoot);
        console.info(
          '[DEV] Run root sync:\n' +
          `stellar contract invoke --id ${process.env.NEXT_PUBLIC_CONTRACT_ID} ` +
          `--source najmi --network testnet -- set_merkle_root ` +
          `--caller GDPAPDZWAKBXUPCNMI4YHAZ7DS7UOUTPGXAFDSWZG4URRMWHFSQTDQBM ` +
          `--new_root ${frontendRoot}`
        );

        throw new Error('Contract Merkle root is out of sync.');
      }

      addLog(
        `Merkle: Proof obtained. Root = ${merkleProof.root.toString().slice(0, 16)}...`
      );

      traceStep(
        trace,
        'merkle:received',
        {
          root:
            merkleProof.root
              .toString()
              .slice(0, 12),
        },
      );

      // ─────────────────────────────────────────────
      // DEV HELPER
      // ─────────────────────────────────────────────

      if (
        process.env.NODE_ENV === 'development'
      ) {
        console.info(
          '[DEV] Frontend root matches contract root.',
        );
      }

      // ─────────────────────────────────────────────
      // ZK PROOF
      // ─────────────────────────────────────────────

      addLog(
        "ZKP: Initializing SnarkJS Groth16 prover..."
      );

      addLog(
        "ZKP: Computing Merkle witness (Depth 20)..."
      );

      traceStep(
        trace,
        'proof:start',
      );

      proofAbortRef.current?.abort();

      proofAbortRef.current =
        new AbortController();

      const zkProof =
        await generateZkProof(
          secret,
          merkleProof,
          hotelWallet,
          rawAmount,

          (
            stage: string,
            pct: number,
          ) => {

            handleProofProgress(
              stage,
              pct,
            );

            traceStep(
              trace,
              'proof:generating',
              {
                stage,
                pct,
              },
            );
          },

          proofAbortRef.current.signal,
        );

      traceStep(
        trace,
        'proof:done',
      );

      addLog(
        "ZKP: Groth16 proof generated successfully."
      );

      // ─────────────────────────────────────────────
      // LOCAL VERIFY
      // ─────────────────────────────────────────────

      if (
        process.env.NODE_ENV === 'development'
      ) {

        addLog(
          "ZKP: Running local pre-verification..."
        );

        traceStep(
          trace,
          'proof:verify_local',
        );

        const isValid =
          await verifyProofLocally(
            zkProof,
          );

        if (!isValid) {
          throw new Error(
            '[ZKP] Local verification FAILED.',
          );
        }

        addLog(
          "ZKP: ✓ Local verification passed."
        );
      }

      // ─────────────────────────────────────────────
      // TX PREP
      // ─────────────────────────────────────────────

      addLog(
        `Stellar: Preparing XDR for Contract: ${process.env.NEXT_PUBLIC_CONTRACT_ID?.slice(0, 8)}...`
      );

      traceStep(
        trace,
        'wallet:sign_request',
      );

      toast.loading(
        "Awaiting Freighter signature...",
        {
          id: "tx-process",
        },
      );

      await createPendingTx({
        id: txId,
        txHash: 'pending',
        amount: `${amount} USDC`,
        recipient: hotelWallet,
        timestamp: Date.now(),
        status: 'pending',
        explorerUrl: '#',
      });

      // ─────────────────────────────────────────────
      // SUBMIT TX
      // ─────────────────────────────────────────────

      traceStep(
        trace,
        'tx:submit',
      );

      const finalResult =
        await withTimeout(
          payWithZkGroth16(
            hotelWallet,
            rawAmount,
            zkProof,
          ),
          120000,
          'Freighter request timeout.',
        ) as {
          status: string;
          txHash?: string;
          hash?: string;
        };

      // ─────────────────────────────────────────────
      // SUCCESS
      // ─────────────────────────────────────────────

      if (
        finalResult?.status === "SUCCESS" ||
        finalResult?.status === "txSuccess"
      ) {

        const hashToDisplay =
          finalResult.txHash ??
          finalResult.hash ??
          "";

        await updateTxRecord(
          txId,
          {
            status: 'success',
            txHash: hashToDisplay,
            explorerUrl:
              buildExplorerUrl(
                hashToDisplay,
              ),
          },
        );

        await finalizeTxHistory(
          txId,
          hashToDisplay,
        );

        finalizeTrace(
          trace,
          'success',
          {
            txHash: hashToDisplay,
          },
        );

        if (mountedRef.current) {

          setTxHash(
            hashToDisplay,
          );

          addLog(
            `✓ SUCCESS: Transaction confirmed on Testnet`
          );

          addLog(
            `Hash: ${hashToDisplay}`
          );

          toast.success(
            "ZK Payment Successful!",
            {
              id: "tx-process",
            },
          );
        }

      } else {
        throw new Error(
          finalResult?.status ??
          "Unknown transaction status",
        );
      }

    } catch (err: unknown) {

      const parsedError =
        parseContractError(err);

      await updateTxRecord(
        txId,
        {
          status: 'failed',
          errorCode:
            parsedError.code,
        },
      );

      traceStep(
        trace,
        'tx:failed',
        {
          errorCode:
            parsedError.code,
        },
      );

      finalizeTrace(
        trace,
        'failed',
        {
          error:
            parsedError.userMessage,

          errorCode:
            parsedError.code,
        },
      );

      capturePaymentError(
        err,
        {
          traceId:
            trace.traceId,

          phase:
            'payment',

          walletAddr:
            walletAddress ??
            undefined,

          contractId:
            process.env.NEXT_PUBLIC_CONTRACT_ID,

          amount,
        },
      );

      if (mountedRef.current) {

        addLog(
          `❌ FAILED: ${parsedError.userMessage}`
        );

        toast.error(
          parsedError.userMessage,
          {
            id: "tx-process",
          },
        );
      }

      console.error(
        "[Fluppy] Full error:",
        err,
      );

    } finally {

      proofAbortRef.current = null;

      if (mountedRef.current) {
        setLoading(false);
        setProofProgress(null);
      }
    }
  };

  // ───────────────────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────────────────

  return {
    walletAddress,
    connectWallet,
    credentialStatus,
    checkCredentialStatus,
    setupCredential,
    loading,
    txHash,
    logs,
    proofProgress,
    setTxHash,
    executePayment,
  };
};