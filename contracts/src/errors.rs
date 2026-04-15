use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FluppyError {
    UnauthorizedMember = 1,
    InsufficientBalance = 2,
    ContractPaused = 3,
    NotAdmin = 4,
    InvalidPaymentAmount = 5,
    Overflow = 6,
}