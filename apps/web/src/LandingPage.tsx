import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from './lib/i18n';
import { 
  Trophy, 
  Play, 
  ArrowRight, 
  Beer, 
  Users, 
  Award, 
  Globe, 
  ChevronRight,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Calendar,
  Settings,
  Plus,
  Shield,
  Smartphone,
  Star,
  Zap,
  Menu,
  X
} from 'lucide-react';

export function LandingPage() {
  const { locale, setLocale } = useI18n();
  const en = locale === 'en';
  const [selectedAnswer, setSelectedAnswer] = useState('B');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060310] text-slate-100 font-sans selection:bg-[#a855f7] selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-900/30 rounded-full blur-[128px]"></div>
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[800px] h-96 bg-violet-950/20 rounded-full blur-[160px]"></div>
        {/* Subtle grid pattern background overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1a3a0f_1px,transparent_1px),linear-gradient(to_bottom,#1f1a3a0f_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ========================================================================= */}
        {/* HEADER / NAVIGATION BAR                                                  */}
        {/* ========================================================================= */}
        <header className="w-full flex items-center justify-between py-6 border-b border-white/5">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 p-0.5 shadow-lg shadow-purple-950/50 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0b071b] rounded-[10px] flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                </svg>
              </div>
            </div>
            <span className="text-2xl font-black tracking-tight text-white flex items-center">
              Quiziciu<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400">S</span>
            </span>
          </Link>

          {/* Central Menu (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-sm text-slate-300 font-medium">
            <a href="#pre-koho" className="hover:text-purple-400 transition-colors">{en ? "Features" : "Funkcie"}</a>
            <a href="#pre-koho" className="hover:text-purple-400 transition-colors">{en ? "For whom" : "Pre koho"}</a>
            <a href="#demo" className="hover:text-purple-400 transition-colors">{en ? "How it works" : "Ako to funguje"}</a>
            <a href="#puby-a-ligy" className="hover:text-purple-400 transition-colors">{en ? "Pubs & leagues" : "Puby a ligy"}</a>
            <a href="#superliga" className="hover:text-purple-400 transition-colors flex items-center gap-1">
              Superliga <span className="bg-gradient-to-r from-amber-500 to-purple-600 text-[10px] font-bold px-1.5 py-0.5 rounded text-white uppercase">New</span>
            </a>
            <a href="#kontakt" className="hover:text-purple-400 transition-colors">{en ? "Contact" : "Kontakt"}</a>
          </nav>

          {/* Right Action Cluster */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-[#120e2e]/80 border border-slate-800 rounded-lg p-1">
              <button type="button" aria-label="Slovenčina" aria-pressed={locale === "sk"} onClick={() => setLocale("sk")} className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${locale === "sk" ? "bg-purple-600/30 text-purple-200 border border-purple-500/30" : "text-slate-400"}`}>
                <span className="text-base leading-none">🇸🇰</span> SK
              </button>
              <button type="button" aria-label="English" aria-pressed={locale === "en"} onClick={() => setLocale("en")} className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 ${locale === "en" ? "bg-purple-600/30 text-purple-200 border border-purple-500/30" : "text-slate-400"}`}>
                <span className="text-base leading-none">🇬🇧</span> EN
              </button>
            </div>

            {/* Ghost Login Button */}
            <Link to="/host" className="border border-slate-700/80 hover:border-purple-500/60 bg-[#0c0f26]/40 hover:bg-purple-950/20 text-slate-200 rounded-xl px-4 py-2 text-sm font-medium transition-all">{en ? "Host sign in" : "Prihlásenie organizátora"}</Link>

            {/* Primary Action Button */}
            <span title={en ? "Team registration is coming soon" : "Registrácia tímov už čoskoro"} className="rounded-xl border border-purple-700/40 px-5 py-2 text-sm text-purple-200">{en ? "Team registration soon" : "Registrácia tímov čoskoro"}</span>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button aria-label={mobileMenuOpen ? (en ? "Close menu" : "Zavrieť menu") : (en ? "Open menu" : "Otvoriť menu")} aria-expanded={mobileMenuOpen} className="lg:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0c0f26]/95 backdrop-blur-xl border border-purple-900/40 rounded-2xl mt-2 p-6 flex flex-col gap-4 shadow-2xl relative z-50">
            <a href="#funkcie" className="text-slate-200 font-medium hover:text-purple-400" onClick={() => setMobileMenuOpen(false)}>{en ? "Features" : "Funkcie"}</a>
            <a href="#pre-koho" className="text-slate-200 font-medium hover:text-purple-400" onClick={() => setMobileMenuOpen(false)}>{en ? "For whom" : "Pre koho"}</a>
            <a href="#ako-to-funguje" className="text-slate-200 font-medium hover:text-purple-400" onClick={() => setMobileMenuOpen(false)}>{en ? "How it works" : "Ako to funguje"}</a>
            <a href="#puby-a-ligy" className="text-slate-200 font-medium hover:text-purple-400" onClick={() => setMobileMenuOpen(false)}>{en ? "Pubs & leagues" : "Puby a ligy"}</a>
            <a href="#superliga" className="text-slate-200 font-medium hover:text-purple-400" onClick={() => setMobileMenuOpen(false)}>{en ? "Super-League" : "Superliga"}</a>
            <a href="#kontakt" className="text-slate-200 font-medium hover:text-purple-400" onClick={() => setMobileMenuOpen(false)}>{en ? "Contact" : "Kontakt"}</a>
            
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
              <Link to="/host" className="w-full border border-slate-700 text-center text-slate-200 rounded-xl py-2.5 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>{en ? "Host sign in" : "Prihlásenie organizátora"}</Link>
              <span className="w-full text-center rounded-xl border border-purple-700/40 py-2.5 text-sm text-purple-200">{en ? "Team registration soon" : "Registrácia tímov čoskoro"}</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* HERO COMPONENT (2-Column Split Grid)                                      */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12 lg:py-16 min-h-[80vh]">
          
          {/* Left Column Panel */}
          <div className="lg:col-span-7 flex flex-col items-start">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 bg-[#7c3aed]/15 text-[#c084fc] border border-[#7c3aed]/40 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 shadow-inner">
              <Trophy size={14} className="text-amber-400 fill-amber-400/20" />
              <span>{en ? "PUB QUIZ PLATFORM & LEAGUES" : "PUB QUIZ PLATFORMA A LIGY"}</span>
            </div>

            {/* Main Display Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
              {en ? "Quiz nights to " : "Kvízové večery, na ktoré sa "}<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#c084fc] to-[#d8b4fe] drop-shadow-[0_0_25px_rgba(168,85,247,0.4)]">{en ? "remember." : "nezabúda."}</span>
            </h1>

            {/* Description Paragraph */}
            <p className="text-lg text-slate-300 max-w-xl leading-relaxed mb-8 font-normal">
              {en ? "Create quizzes, invite teams and compete at your pub, in a league or in the Super-League. Easy hosting, live scores and an unforgettable atmosphere." : "Vytvorte kvíz, pozvite tímy, súťažte vo svojej krčme, lige alebo Superlige. Jednoduché ovládanie, živé skóre a nezabudnuteľná atmosféra."}
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-12 w-full sm:w-auto">
              <Link to="/play" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea] text-white rounded-xl px-7 py-3.5 font-semibold text-base shadow-xl shadow-purple-950/60 hover:shadow-purple-600/40 hover:-translate-y-0.5 transition-all">
                <span>{en ? 'Join a quiz' : 'Pripojiť sa ku kvízu'}</span>
                <ArrowRight size={18} />
              </Link>

              <a href="#demo" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0c0f26]/80 hover:bg-[#161a3f] text-slate-200 border border-slate-700/80 hover:border-slate-500 rounded-xl px-6 py-3.5 font-semibold text-base backdrop-blur-md transition-all">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300">
                  <Play size={12} fill="currentColor" className="ml-0.5" />
                </div>
                <span>{en ? 'See preview' : 'Pozrieť ukážku'}</span>
              </a>
            </div>

            {/* Micro-Feature Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-4 border-t border-slate-800/60">
              
              {/* Feature 1 */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 shadow-md">
                  <Beer size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">{en ? "For pubs" : "Pre puby"}</h4>
                  <p className="text-xs text-slate-400 leading-snug">{en ? "Host quiz nights at your pub" : "Organizujte kvízové večery vo svojej krčme"}</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 shadow-md">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">{en ? "For teams" : "Pre tímy"}</h4>
                  <p className="text-xs text-slate-400 leading-snug">{en ? "Play, track results and climb the leagues" : "Hrajte, sledujte výsledky a postupujte v ligách"}</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
                  <Trophy size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">{en ? "For everyone" : "Pre všetkých"}</h4>
                  <p className="text-xs text-slate-400 leading-snug">{en ? "Local leagues and Super-League finals" : "Lokálne ligy aj Superliga finále"}</p>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column Panel - Graphics Simulation */}
          <div id="demo" className="lg:col-span-5 relative flex items-center justify-center mt-6 lg:mt-0">
            
            {/* Glowing Backdrop Aura */}
            <div className="absolute w-[320px] h-[320px] bg-gradient-to-tr from-purple-600/30 to-amber-500/20 rounded-full blur-[80px]"></div>

            {/* Composition Container */}
            <div className="relative w-full max-w-[420px] flex items-center justify-center">
              
              {/* SMARTPHONE GRAPHIC MOCKUP */}
              <div className="relative z-20 w-[270px] sm:w-[290px] bg-[#090714] border-[6px] border-[#221c3d] rounded-[38px] p-4 shadow-2xl shadow-purple-950/80 ring-1 ring-purple-500/30">
                {/* Notch / Speaker Bar */}
                <div className="w-24 h-4 bg-[#141029] rounded-b-xl mx-auto mb-3 flex items-center justify-center">
                  <div className="w-8 h-1 bg-slate-700 rounded-full"></div>
                </div>

                {/* Mobile Screen Content Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-900/30 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <CrownIcon className="w-4 h-4 text-amber-400" />
                    <span>QuiziciuS</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{en ? "Live" : "Živé vysielanie"}</span>
                  </div>
                </div>

                {/* Question Info Box */}
                <div className="bg-[#120d2c] border border-purple-900/40 rounded-2xl p-3 mb-3">
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-2">
                    <span className="font-semibold text-purple-300">{en ? "Question 3 of 10" : "Otázka 3 z 10"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-700/50 text-amber-300 font-mono font-bold text-[10px]">
                      26s
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-white leading-snug">
                    Ktorá planéta je známa ako Červená planéta?
                  </p>
                </div>

                {/* Multiple Choice Options */}
                <div className="space-y-2 mb-4">
                  {[
                    { id: 'A', label: 'Zem' },
                    { id: 'B', label: 'Mars' },
                    { id: 'C', label: 'Jupiter' },
                    { id: 'D', label: 'Venuša' }
                  ].map((option) => {
                    const isSelected = selectedAnswer === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setSelectedAnswer(option.id)}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-purple-900/80 to-purple-800/80 border-purple-400 text-white shadow-lg shadow-purple-900/50 ring-1 ring-purple-400'
                            : 'bg-[#120e29]/70 border-purple-900/30 text-slate-300 hover:bg-purple-950/40'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                          isSelected ? 'bg-purple-500 text-white' : 'bg-[#1c163b] text-slate-400'
                        }`}>
                          {option.id}
                        </span>
                        <span className="flex-1">{option.label}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-purple-300" />}
                      </button>
                    );
                  })}
                </div>

                {/* Submit Action Button */}
                <div className="w-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white py-2.5 rounded-xl text-center font-bold text-xs shadow-lg shadow-purple-900/50">{en ? "Illustrative preview" : "Ilustračná ukážka"}</div>
              </div>

              {/* REALISTIC HIGH-CONTRAST GOLDEN TROPHY GRAPHIC */}
              <div className="absolute -right-6 sm:-right-12 bottom-2 z-30 w-44 sm:w-52 pointer-events-none filter drop-shadow-[0_20px_25px_rgba(0,0,0,0.8)]">
                <div className="relative transform hover:scale-105 transition-transform duration-500">
                  {/* Glowing Backlight behind Trophy */}
                  <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-2xl"></div>
                  
                  {/* SVG Trophy Graphic */}
                  <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                    {/* Base Pedestal */}
                    <rect x="55" y="200" width="90" height="20" rx="4" fill="url(#baseGrad)" />
                    <rect x="65" y="185" width="70" height="18" rx="2" fill="url(#metalGrad)" />
                    
                    {/* Trophy Stem */}
                    <path d="M88 150 L112 150 L108 186 L92 186 Z" fill="url(#goldGrad1)" />
                    
                    {/* Main Cup Body */}
                    <path d="M45 45 C45 130 80 155 100 155 C120 155 155 130 155 45 L45 45 Z" fill="url(#goldGrad2)" stroke="url(#goldHighlight)" strokeWidth="2" />
                    
                    {/* Cup Rim */}
                    <ellipse cx="100" cy="45" rx="55" ry="12" fill="url(#goldGrad1)" stroke="#fef08a" strokeWidth="2" />
                    <ellipse cx="100" cy="45" rx="48" ry="8" fill="#78350f" opacity="0.6" />
                    
                    {/* Handles Left & Right */}
                    <path d="M46 60 C15 60 15 110 52 120" stroke="url(#goldGrad1)" strokeWidth="10" strokeLinecap="round" fill="none" />
                    <path d="M154 60 C185 60 185 110 148 120" stroke="url(#goldGrad1)" strokeWidth="10" strokeLinecap="round" fill="none" />

                    {/* Emblem Crown on Cup */}
                    <circle cx="100" cy="92" r="22" fill="#451a03" stroke="url(#goldGrad1)" strokeWidth="2" />
                    <path d="M90 98 L86 84 L93 88 L100 81 L107 88 L114 84 L110 98 H90 Z" fill="#fbbf24" />

                    {/* Shining Glare Effects */}
                    <path d="M60 55 C65 90 80 125 90 135" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
                    <circle cx="140" cy="55" r="3" fill="#ffffff" />
                    <circle cx="130" cy="70" r="1.5" fill="#ffffff" />

                    {/* Gradients Definition */}
                    <defs>
                      <linearGradient id="goldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="50%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                      <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#b45309" />
                        <stop offset="30%" stopColor="#f59e0b" />
                        <stop offset="50%" stopColor="#fef08a" />
                        <stop offset="80%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                      <linearGradient id="goldHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                      <linearGradient id="baseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1e1b4b" />
                        <stop offset="50%" stopColor="#312e81" />
                        <stop offset="100%" stopColor="#1e1b4b" />
                      </linearGradient>
                      <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="50%" stopColor="#fef08a" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Pub Sign Mini Graphic (Background Right) */}
              <div className="absolute -left-8 top-12 z-10 hidden sm:block bg-[#16122c]/90 border border-amber-500/30 p-3 rounded-2xl shadow-xl backdrop-blur-md transform -rotate-6">
                <div className="text-center font-serif text-amber-200 text-xs font-bold tracking-widest border border-amber-500/20 p-2 rounded-xl bg-black/40">
                  <div>{en ? "GOOD QUIZ" : "DOBRÝ KVÍZ"}</div>
                  <div className="text-[10px] text-amber-400/80 my-0.5">♥</div>
                  <div>{en ? "GOOD PEOPLE" : "DOBRÍ ĽUDIA"}</div>
                </div>
              </div>

            </div>

          </div>

        </section>

        {/* ========================================================================= */}
        {/* STRUCTURAL SEGMENT: UNIFIED FEATURES SECTION                              */}
        {/* ========================================================================= */}
        <section id="pre-koho" className="w-full max-w-7xl mx-auto my-16 p-6 sm:p-10 lg:p-12 bg-[#090514]/80 border border-[#1b1732] rounded-3xl backdrop-blur-xl shadow-2xl relative">
          
          {/* Header Area */}
          <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Jedna platforma. Tri spôsoby, ako zažiť kvíz.
            </h2>
            <p className="text-base sm:text-lg text-slate-400 font-normal">
              Organizujte, hrajte a súťažte – od lokálnych pubov až po veľké finále Superligy.
            </p>
          </div>

          {/* Grid Layout Architecture (3 Cards) */}
          <div id="puby-a-ligy" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* --------------------------------------------------------------------- */}
            {/* CARD 1: Pre organizátorov                                             */}
            {/* --------------------------------------------------------------------- */}
            <div className="bg-[#0b0e26]/60 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-6 flex flex-col justify-between overflow-hidden group transition-all">
              <div>
                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-lg">
                  <Beer size={28} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{en ? "For hosts" : "Pre organizátorov"}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Vytvorte kvízy, organizujte večery, spravujte ligy a sledujte, ako vaša komunita rastie.
                </p>
              </div>

              {/* Admin Dashboard Mockup Frame (Anchored Bottom) */}
              <div className="mt-4 pt-4 border-t border-slate-800/60 bg-[#070919] border border-purple-950/60 rounded-xl p-3.5 shadow-2xl">
                {/* Laptop Top Bar */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span>Dashboard</span>
                  </div>
                  <span className="bg-purple-600/50 text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                    <Plus size={12} />
                    <span>Nové podujatie</span>
                  </span>
                </div>

                {/* Event List Simulation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-[#0e1233] p-2 rounded-lg border border-purple-900/30">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                        🏆
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-white">{en ? "Weekly quiz" : "Týždenný kvíz"}</div>
                        <div className="text-[9px] text-slate-400">The Crown Inn</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Živo</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#0e1233]/60 p-2 rounded-lg border border-slate-800/40">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">
                        🎵
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-white">{en ? "Music special" : "Hudobný špeciál"}</div>
                        <div className="text-[9px] text-slate-400">The Red Lion</div>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400">21. Nov • 20:00</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#0e1233]/60 p-2 rounded-lg border border-slate-800/40">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                        🎄
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-white">{en ? "Christmas quiz" : "Vianočný kvíz"}</div>
                        <div className="text-[9px] text-slate-400">Crown Inn</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-medium bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{en ? "Upcoming" : "Pripravuje sa"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* CARD 2: Pre tímy                                                      */}
            {/* --------------------------------------------------------------------- */}
            <div className="bg-[#0b0e26]/60 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-6 flex flex-col justify-between overflow-hidden group transition-all">
              <div>
                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5 shadow-lg">
                  <Users size={28} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{en ? "For teams" : "Pre tímy"}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Zaregistrujte svoj tím, hrajte naživo, sledujte výsledky a postupujte v rebríčkoch.
                </p>
              </div>

              {/* Team Profile Phone Simulation (Anchored Bottom) */}
              <div className="mt-4 pt-4 border-t border-slate-800/60 bg-[#070919] border border-purple-950/60 rounded-xl p-4 shadow-2xl flex flex-col items-center text-center">
                
                {/* Team Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 p-0.5 mb-2 shadow-md">
                  <div className="w-full h-full bg-[#0d0a21] rounded-full flex items-center justify-center text-xl">
                    🧠
                  </div>
                </div>

                <h4 className="text-sm font-black text-white">The Brainiacs</h4>
                <p className="text-[10px] text-purple-300 font-medium mb-4">Lokálna liga Pub Quiz</p>

                {/* Team Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 w-full bg-[#0e112d] p-2.5 rounded-xl border border-purple-900/30 mb-4 text-center">
                  <div>
                    <div className="text-sm font-black text-white">12</div>
                    <div className="text-[9px] text-slate-400">{en ? "Played" : "Odohraných"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-amber-400">3</div>
                    <div className="text-[9px] text-slate-400">{en ? "Wins" : "Víťazstvá"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-black text-purple-300">5.</div>
                    <div className="text-[9px] text-slate-400">{en ? "League rank" : "Pozícia v lige"}</div>
                  </div>
                </div>

                {/* Quick Buttons */}
                <Link to="/play" className="block w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded-lg mb-2 shadow-md transition-colors">{en ? "Join a quiz" : "Pripojiť sa ku kvízu"}</Link>
                <span className="block w-full border border-slate-700 text-slate-400 text-xs font-semibold py-1.5 rounded-lg">{en ? "Results coming soon" : "Výsledky už čoskoro"}</span>
              </div>
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* CARD 3: Pre ligy a Superligu                                          */}
            {/* --------------------------------------------------------------------- */}
            <div id="superliga" className="bg-[#0b0e26]/60 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-6 flex flex-col justify-between overflow-hidden group transition-all">
              <div>
                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-lg">
                  <Award size={28} />
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{en ? "For leagues and the Super-League" : "Pre ligy a Superligu"}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Budujte lokálne ligy, kvalifikujte sa do Superligy a zažite veľké finále s najlepšími tímami.
                </p>
              </div>

              {/* Transition Graphic Banner & Metrics Footer */}
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                
                {/* League Transition Badge Graphic */}
                <div className="relative rounded-xl overflow-hidden p-4 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border border-purple-800/40 flex items-center justify-around mb-6 shadow-xl">
                  {/* Background Concert Lights Effect */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent"></div>

                  {/* Pub League Shield */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-12 h-14 bg-gradient-to-b from-amber-600 to-amber-800 rounded-b-xl border border-amber-400 flex items-center justify-center shadow-lg">
                      <Beer size={20} className="text-amber-200" />
                    </div>
                    <span className="text-[10px] font-black text-amber-300 tracking-wider mt-1">{en ? "PUB LEAGUES" : "PUB LIGY"}</span>
                  </div>

                  {/* Transition Arrow */}
                  <div className="relative z-10 flex flex-col items-center text-purple-400">
                    <ArrowRight size={22} className="animate-pulse" />
                  </div>

                  {/* Superliga Shield */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-14 h-16 bg-gradient-to-b from-purple-600 via-indigo-700 to-purple-900 rounded-b-xl border-2 border-amber-400 flex flex-col items-center justify-center shadow-xl shadow-purple-900/60">
                      <CrownIcon className="w-6 h-6 text-amber-400 mb-0.5" />
                    </div>
                    <span className="text-[10px] font-black text-purple-200 tracking-wider mt-1">{en ? "SUPER-LEAGUE" : "SUPERLIGA"}</span>
                  </div>
                </div>

                {/* Structural Stat Metrics Row */}
                <div className="grid grid-cols-3 text-center pt-2">
                  <div className="border-r border-slate-800/80 pr-2">
                    <div className="text-xl font-black text-white">🍻</div>
                    <div className="text-[10px] text-slate-400 font-medium">{en ? "Local pubs" : "Pubs v systéme"}</div>
                  </div>
                  <div className="border-r border-slate-800/80 px-2">
                    <div className="text-xl font-black text-purple-300">👥</div>
                    <div className="text-[10px] text-slate-400 font-medium">{en ? "Teams" : "Aktívnych tímov"}</div>
                  </div>
                  <div className="pl-2">
                    <div className="text-xl font-black text-amber-400">🏆</div>
                    <div className="text-[10px] text-slate-400 font-medium">{en ? "Grand final" : "Veľké finále"}</div>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </section>

        {/* ========================================================================= */}
        {/* FOOTER BAR                                                                */}
        {/* ========================================================================= */}
        <footer id="kontakt" className="w-full py-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">QuiziciuS</span>
            <span>© 2026 Všetky práva vyhradené.</span>
          </div>

          <div className="flex items-center gap-6">
            <span>{en ? "Privacy policy forthcoming" : "Ochrana osobných údajov – pripravujeme"}</span>
            <span>{en ? "Terms forthcoming" : "Podmienky používania – pripravujeme"}</span>
            <span>{en ? "Support forthcoming" : "Podpora – pripravujeme"}</span>
          </div>
        </footer>

      </div>
    </div>
  );
}

// Inline Helper Crown Icon Component
function CrownIcon({ className = "w-5 h-5 text-amber-400" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
    </svg>
  );
}