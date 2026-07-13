"use client";

import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type TestStatus = "idle" | "typing" | "completed";
type Duration = 15 | 30 | 60;

type CaretBox = {
  left: number;
  top: number;
  height: number;
};

const COMMON_WORDS = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
] as const;

const DURATIONS: Duration[] = [15, 30, 60];

export default function TypingTest() {
  const words = useMemo(() => [...COMMON_WORDS], []);
  const [duration, setDuration] = useState<Duration>(30);
  const [remainingTime, setRemainingTime] = useState<number>(duration);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [typedWords, setTypedWords] = useState<string[]>(() =>
    words.map(() => ""),
  );
  const [keystrokes, setKeystrokes] = useState({ correct: 0, incorrect: 0 });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [caretBox, setCaretBox] = useState<CaretBox>({
    left: 0,
    top: 0,
    height: 32,
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLSpanElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  const totalKeystrokes = keystrokes.correct + keystrokes.incorrect;
  const elapsedSeconds =
    status === "idle" ? 0 : Math.max(1, duration - remainingTime);

  const wpm = Math.round((keystrokes.correct / 5 / (elapsedSeconds / 60)) || 0);

  const accuracy = totalKeystrokes
    ? Math.round((keystrokes.correct / totalKeystrokes) * 100)
    : 100;

  const reset = useCallback(
    (nextDuration = duration) => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setDuration(nextDuration);
      setRemainingTime(nextDuration);
      setStatus("idle");
      setCurrentWordIndex(0);
      setCurrentCharacterIndex(0);
      setTypedWords(words.map(() => ""));
      setKeystrokes({ correct: 0, incorrect: 0 });
      setStartedAt(null);
      window.requestAnimationFrame(() => rootRef.current?.focus());
    },
    [duration, words],
  );

  const measureCaret = useCallback(() => {
    const textNode = textRef.current;
    const activeNode = activeRef.current;

    if (!textNode || !activeNode) {
      return;
    }

    const textRect = textNode.getBoundingClientRect();
    const activeRect = activeNode.getBoundingClientRect();
    const isEndMarker = activeNode.dataset.caret === "end";

    setCaretBox({
      left: activeRect.left - textRect.left + (isEndMarker ? activeRect.width : 0),
      top: activeRect.top - textRect.top,
      height: activeRect.height || 32,
    });
  }, []);

  useEffect(() => {
    measureCaret();

    const observer = new ResizeObserver(measureCaret);
    if (textRef.current) {
      observer.observe(textRef.current);
    }

    window.addEventListener("resize", measureCaret);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureCaret);
    };
  }, [measureCaret, currentWordIndex, currentCharacterIndex, typedWords]);

  useEffect(() => {
    if (status !== "typing" || startedAt === null) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const nextRemaining = Math.max(0, duration - elapsed);

      setRemainingTime(nextRemaining);

      if (nextRemaining === 0) {
        setStatus("completed");
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [duration, startedAt, status]);

  const startIfNeeded = () => {
    if (status === "idle") {
      setStatus("typing");
      setStartedAt(Date.now());
    }
  };

  const gradeCharacter = (
    character: string,
    wordIndex: number,
    characterIndex: number,
  ) => {
    const expected = words[wordIndex]?.[characterIndex];
    return character === expected;
  };

  const typeCharacter = (character: string) => {
    if (status === "completed" || currentWordIndex >= words.length) {
      return;
    }

    startIfNeeded();

    setTypedWords((previous) => {
      const next = [...previous];
      next[currentWordIndex] = `${next[currentWordIndex]}${character}`;
      return next;
    });

    const isCorrect = gradeCharacter(
      character,
      currentWordIndex,
      currentCharacterIndex,
    );

    setKeystrokes((previous) => ({
      correct: previous.correct + (isCorrect ? 1 : 0),
      incorrect: previous.incorrect + (isCorrect ? 0 : 1),
    }));

    setCurrentCharacterIndex((previous) => previous + 1);
  };

  const completeWord = () => {
    if (status === "completed") {
      return;
    }

    const currentInput = typedWords[currentWordIndex] ?? "";
    if (!currentInput) {
      return;
    }

    startIfNeeded();

    const isCorrectSpace = currentInput === words[currentWordIndex];

    setKeystrokes((previous) => ({
      correct: previous.correct + (isCorrectSpace ? 1 : 0),
      incorrect: previous.incorrect + (isCorrectSpace ? 0 : 1),
    }));

    const nextWordIndex = currentWordIndex + 1;

    if (nextWordIndex >= words.length) {
      setStatus("completed");
      setRemainingTime((previous) => Math.max(0, previous));
      return;
    }

    setCurrentWordIndex(nextWordIndex);
    setCurrentCharacterIndex(0);
  };

  const deleteCharacter = () => {
    if (status === "completed" || currentCharacterIndex === 0) {
      return;
    }

    setTypedWords((previous) => {
      const next = [...previous];
      next[currentWordIndex] = next[currentWordIndex].slice(0, -1);
      return next;
    });

    setCurrentCharacterIndex((previous) => Math.max(0, previous - 1));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      reset();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      deleteCharacter();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      completeWord();
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      typeCharacter(event.key);
    }
  };

  const renderCharacter = (
    character: string,
    wordIndex: number,
    characterIndex: number,
  ) => {
    const typedCharacter = typedWords[wordIndex]?.[characterIndex];
    const isActive =
      wordIndex === currentWordIndex && characterIndex === currentCharacterIndex;

    const className =
      typedCharacter === undefined
        ? "text-[#646669]"
        : typedCharacter === character
          ? "text-[#d1d0c5]"
          : "bg-[#7e2a33]/40 text-[#ca4754]";

    return (
      <span
        key={`${wordIndex}-${characterIndex}`}
        ref={isActive ? activeRef : null}
        className={className}
      >
        {character}
      </span>
    );
  };

  const renderExtraCharacters = (word: string, wordIndex: number) => {
    const extras = (typedWords[wordIndex] ?? "").slice(word.length).split("");

    return extras.map((character, extraIndex) => {
      const isActive =
        wordIndex === currentWordIndex &&
        currentCharacterIndex === word.length + extraIndex;

      return (
        <span
          key={`${wordIndex}-extra-${extraIndex}`}
          ref={isActive ? activeRef : null}
          className="bg-[#7e2a33]/40 text-[#ca4754]"
        >
          {character}
        </span>
      );
    });
  };

  return (
    <main className="min-h-screen bg-[#191919] px-6 py-8 text-[#d1d0c5]">
      <section
        ref={rootRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl content-center gap-14 outline-none"
      >
        <nav className="flex items-center justify-center gap-8 font-mono text-sm text-[#646669]">
          <div className="flex items-center gap-5">
            {DURATIONS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => reset(seconds)}
                className={`transition-colors hover:text-[#d1d0c5] ${
                  duration === seconds ? "text-[#e2b714]" : ""
                }`}
                aria-pressed={duration === seconds}
              >
                {seconds}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => reset()}
            className="text-[#646669] transition-colors hover:text-[#e2b714]"
            aria-label="Reset test"
          >
            reset
          </button>
        </nav>

        <div className="grid gap-8 font-mono">
          <div className="flex items-end justify-between gap-6 text-[#646669]">
            <div className="text-4xl text-[#e2b714]">{remainingTime}</div>

            <div className="flex gap-6 text-sm">
              <span>{wpm} wpm</span>
              <span>{accuracy}% acc</span>
              <span>{status}</span>
            </div>
          </div>

          <div
            ref={textRef}
            onClick={() => rootRef.current?.focus()}
            className="relative text-[clamp(1.8rem,4vw,2.35rem)] leading-[1.65] tracking-normal"
          >
            <span
              aria-hidden="true"
              className={`absolute z-10 w-[2px] rounded-full bg-[#e2b714] transition-all duration-100 ${
                status === "completed" ? "opacity-0" : "animate-pulse"
              }`}
              style={{
                height: `${caretBox.height}px`,
                transform: `translate(${caretBox.left}px, ${caretBox.top}px)`,
              }}
            />

            <div className="flex flex-wrap content-start gap-x-4 gap-y-1">
              {words.map((word, wordIndex) => {
                const caretAtEnd =
                  wordIndex === currentWordIndex &&
                  currentCharacterIndex >= word.length;

                return (
                  <span key={wordIndex} className="inline-flex">
                    {word
                      .split("")
                      .map((character, characterIndex) =>
                        renderCharacter(character, wordIndex, characterIndex),
                      )}

                    {renderExtraCharacters(word, wordIndex)}

                    <span
                      ref={caretAtEnd ? activeRef : null}
                      data-caret="end"
                      className="inline-block w-0"
                    />
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
