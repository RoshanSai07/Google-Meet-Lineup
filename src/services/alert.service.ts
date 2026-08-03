let nextAudio: HTMLAudioElement | null = null;
let interviewAudio: HTMLAudioElement | null = null;

function createAudio(src: string, volume: number) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = volume;

  return audio;
}

function getNextAudio() {
  if (!nextAudio) {
    nextAudio = createAudio("/sounds/next.mp3", 0.7);
  }

  return nextAudio;
}

function getInterviewAudio() {
  if (!interviewAudio) {
    interviewAudio = createAudio("/sounds/interview.mp3", 1);
  }

  return interviewAudio;
}

/**
 * Call this from a user click such as "Join queue".
 * It helps unlock audio playback in browsers.
 */
export function prepareAlerts() {
  const sounds = [getNextAudio(), getInterviewAudio()];

  sounds.forEach((audio) => {
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {
        // Browser may still block autoplay.
      });
  });
}

export async function playNextAlert() {
  const audio = getNextAudio();

  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    console.warn("Couldn't play next alert:", error);
  }
}

export async function playInterviewAlert() {
  const audio = getInterviewAudio();

  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    console.warn("Couldn't play interview alert:", error);
  }
}

export function stopAlerts() {
  if (nextAudio) {
    nextAudio.pause();
    nextAudio.currentTime = 0;
  }

  if (interviewAudio) {
    interviewAudio.pause();
    interviewAudio.currentTime = 0;
  }
}
