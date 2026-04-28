import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { GoArrowUpRight } from 'react-icons/go';
import { FiKey } from 'react-icons/fi';
import { BsStars } from 'react-icons/bs'; 

type CardNavLink = {
    label: string;
    href: string;
    ariaLabel: string;
};

export type CardNavItem = {
    label: string;
    bgColor: string;
    textColor: string;
    links: CardNavLink[];
};

export interface CardNavProps {
    publicKey: string | null;
    onConnectWallet: () => void;
    // ─────────────────────────────────────
    items: CardNavItem[];
    className?: string;
    ease?: string;
    baseColor?: string;
    menuColor?: string;
}

const CardNav: React.FC<CardNavProps> = ({
    publicKey,
    onConnectWallet,
    items,
    className = '',
    ease = 'power3.out',
    baseColor = 'rgba(30, 27, 36, 0.8)', // Default dark glass
    menuColor = '#fff',
}) => {
    const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const navRef = useRef<HTMLDivElement | null>(null);
    const cardsRef = useRef<HTMLDivElement[]>([]);
    const tlRef = useRef<gsap.core.Timeline | null>(null);

    // ─── LOGIKA AUTO-CLOSE SAAT DI-SCROLL ───
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20 && isExpanded) {
                const tl = tlRef.current;
                if (tl) {
                    setIsHamburgerOpen(false);
                    tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
                    tl.reverse();
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isExpanded]);

    const calculateHeight = () => {
        const navEl = navRef.current;
        if (!navEl) return 260;

        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            const contentEl = navEl.querySelector('.card-nav-content') as HTMLElement;
            if (contentEl) {
                const wasVisible = contentEl.style.visibility;
                const wasPointerEvents = contentEl.style.pointerEvents;
                const wasPosition = contentEl.style.position;
                const wasHeight = contentEl.style.height;

                contentEl.style.visibility = 'visible';
                contentEl.style.pointerEvents = 'auto';
                contentEl.style.position = 'static';
                contentEl.style.height = 'auto';

                contentEl.offsetHeight;

                const topBar = 60;
                const padding = 16;
                const contentHeight = contentEl.scrollHeight;

                contentEl.style.visibility = wasVisible;
                contentEl.style.pointerEvents = wasPointerEvents;
                contentEl.style.position = wasPosition;
                contentEl.style.height = wasHeight;

                return topBar + contentHeight + padding;
            }
        }
        return 260;
    };

    const createTimeline = () => {
        const navEl = navRef.current;
        if (!navEl) return null;

        gsap.set(navEl, { height: 60, overflow: 'hidden' });
        gsap.set(cardsRef.current, { y: 50, opacity: 0 });

        const tl = gsap.timeline({ paused: true });

        tl.to(navEl, { height: calculateHeight, duration: 0.4, ease });
        tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1');

        return tl;
    };

    useLayoutEffect(() => {
        const tl = createTimeline();
        tlRef.current = tl;

        return () => {
            tl?.kill();
            tlRef.current = null;
        };
    }, [ease, items]);

    const toggleMenu = () => {
        const tl = tlRef.current;
        if (!tl) return;
        if (!isExpanded) {
            setIsHamburgerOpen(true);
            setIsExpanded(true);
            tl.play(0);
        } else {
            setIsHamburgerOpen(false);
            tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
            tl.reverse();
        }
    };

    const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
        if (el) cardsRef.current[i] = el;
    };

    return (
        <div className={`card-nav-container fixed left-1/2 -translate-x-1/2 w-[90%] max-w-[1000px] z-[100] top-[1.2em] md:top-[1.5em] ${className}`}>
            <nav
                ref={navRef}
                className={`card-nav ${isExpanded ? 'open' : ''} block h-[60px] p-0 rounded-2xl shadow-2xl relative overflow-hidden will-change-[height] border`}
                style={{ backgroundColor: baseColor, backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.08)" }}
            >
                <div className="card-nav-top absolute inset-x-0 top-0 h-[60px] flex items-center justify-between p-2 pl-[1.1rem] z-[2]">

                    {/* Hamburger Menu */}
                    <div
                        className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''} group h-full flex flex-col items-center justify-center cursor-pointer gap-[6px] order-2 md:order-none`}
                        onClick={toggleMenu}
                        role="button"
                        tabIndex={0}
                        style={{ color: menuColor }}
                    >
                        <div className={`hamburger-line w-[24px] h-[2px] bg-current transition-[transform,opacity,margin] duration-300 ease-linear [transform-origin:50%_50%] ${isHamburgerOpen ? 'translate-y-[4px] rotate-45' : ''} group-hover:opacity-75`} />
                        <div className={`hamburger-line w-[24px] h-[2px] bg-current transition-[transform,opacity,margin] duration-300 ease-linear [transform-origin:50%_50%] ${isHamburgerOpen ? '-translate-y-[4px] -rotate-45' : ''} group-hover:opacity-75`} />
                    </div>

                    {/* 👇 Logo Fluppy + Ikon Kotak Pink 👇 */}
                    <div className="logo-container flex items-center gap-2.5 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 order-1 md:order-none pointer-events-none">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#FF85BB" }}>
                            <BsStars className="text-black text-sm" />
                        </div>
                        <span className="font-bold text-lg text-white tracking-tight">FLUPPY</span>
                    </div>

                    {/* Connect Wallet Button */}
                    <button
                        onClick={onConnectWallet}
                        className="hidden md:inline-flex px-5 py-2 rounded-xl text-sm font-bold border transition-all hover:scale-105 active:scale-95 z-[60] items-center gap-2"
                        style={{
                            // Efek Glassmorphism Disesuaikan dengan tema Pink #FF85BB
                            backgroundColor: publicKey ? `rgba(255, 133, 187, 0.15)` : `rgba(255, 255, 255, 0.05)`,
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            color: publicKey ? "#FF85BB" : "white",
                            borderColor: publicKey ? `rgba(255, 133, 187, 0.3)` : `rgba(255, 255, 255, 0.1)`,
                            boxShadow: publicKey
                                ? "0 0 20px -5px rgba(255, 133, 187, 0.4)"
                                : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                    >
                        {publicKey ? (
                            <>
                                <FiKey className="text-lg" />
                                {`${publicKey.slice(0, 5)}...${publicKey.slice(-4)}`}
                            </>
                        ) : (
                            "Connect Wallet"
                        )}
                    </button>
                </div>

                {/* Expanded Menu Cards */}
                <div className={`card-nav-content absolute left-0 right-0 top-[60px] bottom-0 p-3 flex flex-col items-stretch gap-3 justify-start z-[1] ${isExpanded ? 'visible pointer-events-auto' : 'invisible pointer-events-none'} md:flex-row md:items-end md:gap-[12px]`}>
                    {(items || []).slice(0, 3).map((item, idx) => (
                        <div
                            key={`${item.label}-${idx}`}
                            className="nav-card select-none relative flex flex-col gap-2 p-[16px_20px] rounded-xl border min-w-0 flex-[1_1_auto] h-auto min-h-[60px] md:h-full md:min-h-0 md:flex-[1_1_0%]"
                            ref={setCardRef(idx)}
                            style={{ backgroundColor: item.bgColor, color: item.textColor, borderColor: "rgba(255,255,255,0.05)" }}
                        >
                            <div className="nav-card-label font-semibold tracking-tight text-[18px] md:text-[20px] mb-2">
                                {item.label}
                            </div>
                            <div className="nav-card-links mt-auto flex flex-col gap-[6px]">
                                {item.links?.map((lnk, i) => (
                                    <a key={`${lnk.label}-${i}`} href={lnk.href} className="nav-card-link inline-flex items-center gap-[8px] no-underline cursor-pointer transition-opacity duration-300 hover:opacity-75 text-[14px] md:text-[15px] opacity-80 hover:opacity-100">
                                        <GoArrowUpRight className="nav-card-link-icon shrink-0" aria-hidden="true" />
                                        {lnk.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default CardNav;