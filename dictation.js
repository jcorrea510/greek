// Speak English instead of typing, using the browser's speech recognition.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const supported = !!Recognition;

// onText(fullText, isFinal) fires as words come in; onEnd() when listening stops.
export function listen({ onText, onEnd, onError }) {
  const rec = new Recognition();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;

  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript.trim() + ' ';
      else interim += r[0].transcript;
    }
    onText((finalText + interim).trim(), !interim);
  };
  rec.onerror = e => onError?.(e.error);
  rec.onend = () => onEnd?.();
  rec.start();
  return () => rec.stop();
}
