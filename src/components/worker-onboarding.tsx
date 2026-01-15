"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MessageCircle,
  Briefcase,
  Sparkles,
  ChevronRight,
  Check,
  Smartphone,
  Share,
  MoreVertical,
  Plus,
  Square
} from "lucide-react";

interface WorkerOnboardingProps {
  workerName: string;
  organizationName: string;
  onComplete: () => void;
}

// Fun, abstract one-liners - no carpentry clichés
const ONE_LINERS = [
  "The universe has been refreshing this page waiting for you.",
  "Plot twist: you're the main character now.",
  "Your future self just sent a thank you note.",
  "The algorithm thinks you're pretty cool.",
  "Somewhere, a notification is very excited to meet you.",
  "Today's forecast: productive with a chance of snacks.",
  "Achievement unlocked: showing up.",
  "The WiFi is strong with this one.",
  "This is your sign. Literally.",
  "Your inbox has never looked so hopeful.",
  "Ready to make today interesting? No pressure.",
  "The pixels have assembled in your honor.",
  "Fun fact: you're already doing great.",
  "The loading bar completed just for you.",
  "Your profile picture looks amazing today.",
  "The database query returned: awesome.",
  "Spoiler alert: you've got this.",
  "The notifications are queuing up to meet you.",
  "System status: ready to impress.",
  "Breaking news: you're here, and that's great.",
];

// Generate a consistent one-liner based on name (so same user sees same message)
function getOneLiner(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ONE_LINERS[hash % ONE_LINERS.length];
}

// Get first name only
function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

const FEATURES = [
  {
    id: "timesheets",
    icon: Clock,
    title: "Log Your Hours",
    description: "Submit timesheets digitally or snap a photo of your signed sheet. We'll handle the rest.",
    tip: "Pro tip: The photo upload uses AI to read your handwriting. Magic, basically.",
  },
  {
    id: "jobs",
    icon: Briefcase,
    title: "Your Jobs",
    description: "See where you're working, get directions, and track what's happening on each site.",
    tip: "Tap any address to open it in Maps. No more typing addresses.",
  },
  {
    id: "chat",
    icon: MessageCircle,
    title: "Team Chat",
    description: "Stay connected with your crew. Job updates, questions, or just saying g'day.",
    tip: "You're already in the company channel. Say hi when you're ready.",
  },
  {
    id: "knowledge",
    icon: Sparkles,
    title: "AI Assistant",
    description: "Got a question about building codes or standards? Ask the AI. It knows things.",
    tip: "Try asking about NCC requirements or timber spans. It's surprisingly helpful.",
  },
];

export function WorkerOnboarding({
  workerName,
  organizationName,
  onComplete
}: WorkerOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<"welcome" | "features" | "install" | "ready">("welcome");
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [viewedFeatures, setViewedFeatures] = useState<Set<string>>(new Set());
  const [selectedPlatform, setSelectedPlatform] = useState<"ios" | "android" | null>(null);

  const firstName = useMemo(() => getFirstName(workerName), [workerName]);
  const oneLiner = useMemo(() => getOneLiner(workerName), [workerName]);

  const currentFeature = FEATURES[currentFeatureIndex];
  const isLastFeature = currentFeatureIndex === FEATURES.length - 1;

  const handleNextFeature = () => {
    setViewedFeatures(prev => new Set([...prev, currentFeature.id]));

    if (isLastFeature) {
      setCurrentStep("install");
    } else {
      setCurrentFeatureIndex(prev => prev + 1);
    }
  };

  const handleSkipToEnd = () => {
    setCurrentStep("ready");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(212,165,116,0.3) 0%, transparent 70%)",
            animation: "pulse-bg 8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay" />

      <AnimatePresence mode="wait">
        {/* STEP 1: Welcome Splash */}
        {currentStep === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5 }}
            className="relative h-full flex flex-col items-center justify-center px-6 text-center"
          >
            {/* Small org name */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-[var(--foreground-muted)] text-sm tracking-[0.3em] uppercase mb-6"
            >
              Welcome to {organizationName}
            </motion.p>

            {/* Big name greeting */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-display)] text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-6"
              style={{
                background: "linear-gradient(135deg, #fafafa 0%, #d4a574 50%, #fafafa 100%)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "gradient-shift 6s ease infinite",
              }}
            >
              Hey, {firstName}
            </motion.h1>

            {/* Fun one-liner */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-xl sm:text-2xl text-[var(--foreground-muted)] max-w-lg leading-relaxed"
            >
              {oneLiner}
            </motion.p>

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              onClick={() => setCurrentStep("features")}
              className="mt-16 group flex items-center gap-3 text-lg font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              <span>Let's get you set up</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        )}

        {/* STEP 2: Feature Walkthrough */}
        {currentStep === "features" && (
          <motion.div
            key="features"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-full flex flex-col"
          >
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--border)]">
              <motion.div
                className="h-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${((currentFeatureIndex + 1) / FEATURES.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Skip button */}
            <div className="absolute top-6 right-6">
              <button
                onClick={handleSkipToEnd}
                className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Skip tour
              </button>
            </div>

            {/* Feature content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFeature.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  className="max-w-md text-center"
                >
                  {/* Feature icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8"
                    style={{
                      background: "linear-gradient(135deg, var(--accent) 0%, rgba(212,165,116,0.6) 100%)",
                      boxShadow: "0 8px 32px rgba(212,165,116,0.3)",
                    }}
                  >
                    <currentFeature.icon className="w-10 h-10 text-[var(--background)]" />
                  </motion.div>

                  {/* Feature step indicator */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-[var(--accent)] text-sm font-medium tracking-wider uppercase mb-4"
                  >
                    {currentFeatureIndex + 1} of {FEATURES.length}
                  </motion.p>

                  {/* Feature title */}
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl font-bold mb-6"
                  >
                    {currentFeature.title}
                  </motion.h2>

                  {/* Feature description */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg text-[var(--foreground-muted)] mb-8 leading-relaxed"
                  >
                    {currentFeature.description}
                  </motion.p>

                  {/* Pro tip */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="inline-block px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)]"
                  >
                    <p className="text-sm text-[var(--foreground-muted)]">
                      <span className="text-[var(--accent)] font-medium">Tip: </span>
                      {currentFeature.tip}
                    </p>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom navigation */}
            <div className="p-6 flex justify-center">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={handleNextFeature}
                className="btn-primary flex items-center gap-2 text-lg"
              >
                <span>{isLastFeature ? "Let's go!" : "Next"}</span>
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Feature dots */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.id}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentFeatureIndex
                      ? "bg-[var(--accent)] w-6"
                      : index < currentFeatureIndex
                      ? "bg-[var(--accent)] opacity-50"
                      : "bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Add to Home Screen */}
        {currentStep === "install" && (
          <motion.div
            key="install"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-full flex flex-col"
          >
            {/* Skip button */}
            <div className="absolute top-6 right-6">
              <button
                onClick={() => setCurrentStep("ready")}
                className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Skip
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <AnimatePresence mode="wait">
                {!selectedPlatform ? (
                  <motion.div
                    key="platform-select"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="max-w-md text-center"
                  >
                    {/* Icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8"
                      style={{
                        background: "linear-gradient(135deg, var(--accent) 0%, rgba(212,165,116,0.6) 100%)",
                        boxShadow: "0 8px 32px rgba(212,165,116,0.3)",
                      }}
                    >
                      <Smartphone className="w-10 h-10 text-[var(--background)]" />
                    </motion.div>

                    <h2 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl font-bold mb-4">
                      Add to Home Screen
                    </h2>
                    <p className="text-lg text-[var(--foreground-muted)] mb-10">
                      For the best experience, add this app to your home screen. Quick access, just like a native app.
                    </p>

                    <p className="text-sm text-[var(--foreground-muted)] mb-6">What device are you using?</p>

                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => setSelectedPlatform("ios")}
                        className="flex-1 max-w-[160px] p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition-colors group"
                      >
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                          </svg>
                        </div>
                        <p className="font-medium group-hover:text-[var(--accent)] transition-colors">iPhone</p>
                        <p className="text-xs text-[var(--foreground-muted)]">iOS / Safari</p>
                      </button>

                      <button
                        onClick={() => setSelectedPlatform("android")}
                        className="flex-1 max-w-[160px] p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition-colors group"
                      >
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
                          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
                          </svg>
                        </div>
                        <p className="font-medium group-hover:text-[var(--accent)] transition-colors">Android</p>
                        <p className="text-xs text-[var(--foreground-muted)]">Chrome</p>
                      </button>
                    </div>
                  </motion.div>
                ) : selectedPlatform === "ios" ? (
                  <motion.div
                    key="ios-instructions"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="max-w-md text-center"
                  >
                    <button
                      onClick={() => setSelectedPlatform(null)}
                      className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 inline-flex items-center gap-1"
                    >
                      ← Back
                    </button>

                    <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold mb-6">
                      Add to Home Screen on iPhone
                    </h2>

                    <div className="space-y-4 text-left">
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center flex-shrink-0 font-bold">1</div>
                        <div>
                          <p className="font-medium mb-1">Tap the Share button</p>
                          <p className="text-sm text-[var(--foreground-muted)]">Look for the share icon <Share className="w-4 h-4 inline-block mx-1" /> at the bottom of Safari</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center flex-shrink-0 font-bold">2</div>
                        <div>
                          <p className="font-medium mb-1">Scroll down and tap "Add to Home Screen"</p>
                          <p className="text-sm text-[var(--foreground-muted)]">Look for <Plus className="w-4 h-4 inline-block mx-1" /> Add to Home Screen in the menu</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center flex-shrink-0 font-bold">3</div>
                        <div>
                          <p className="font-medium mb-1">Tap "Add" in the top right</p>
                          <p className="text-sm text-[var(--foreground-muted)]">The app will appear on your home screen</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setCurrentStep("ready")}
                      className="btn-primary mt-8"
                    >
                      Done, let's go!
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="android-instructions"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="max-w-md text-center"
                  >
                    <button
                      onClick={() => setSelectedPlatform(null)}
                      className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-6 inline-flex items-center gap-1"
                    >
                      ← Back
                    </button>

                    <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold mb-6">
                      Add to Home Screen on Android
                    </h2>

                    <div className="space-y-4 text-left">
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center flex-shrink-0 font-bold">1</div>
                        <div>
                          <p className="font-medium mb-1">Tap the menu button</p>
                          <p className="text-sm text-[var(--foreground-muted)]">Look for the three dots <MoreVertical className="w-4 h-4 inline-block mx-1" /> in the top right of Chrome</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center flex-shrink-0 font-bold">2</div>
                        <div>
                          <p className="font-medium mb-1">Tap "Add to Home screen"</p>
                          <p className="text-sm text-[var(--foreground-muted)]">You might also see "Install app" - that works too!</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--background)] flex items-center justify-center flex-shrink-0 font-bold">3</div>
                        <div>
                          <p className="font-medium mb-1">Tap "Add" to confirm</p>
                          <p className="text-sm text-[var(--foreground-muted)]">The app will appear on your home screen</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setCurrentStep("ready")}
                      className="btn-primary mt-8"
                    >
                      Done, let's go!
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Ready to go */}
        {currentStep === "ready" && (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative h-full flex flex-col items-center justify-center px-6 text-center"
          >
            {/* Success checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, rgba(212,165,116,0.6) 100%)",
                boxShadow: "0 8px 48px rgba(212,165,116,0.4)",
              }}
            >
              <Check className="w-12 h-12 text-[var(--background)]" strokeWidth={3} />
            </motion.div>

            {/* Ready message */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-bold mb-4"
            >
              You're all set, {firstName}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-xl text-[var(--foreground-muted)] mb-12 max-w-md"
            >
              Time to get stuck in. Your dashboard is ready and waiting.
            </motion.p>

            {/* Go to dashboard button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onComplete}
              className="btn-primary text-lg px-8 py-4"
            >
              Open Dashboard
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom keyframes */}
      <style jsx global>{`
        @keyframes pulse-bg {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.2;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.3;
          }
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}
