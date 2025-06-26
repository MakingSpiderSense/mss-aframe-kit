/**
 * Music Player Component
 *
 * Overview: A component that plays a playlist of songs, allowing control via VR controllers or keyboard input.
 *
 * Description: This component plays a series of audio files (such as MP3s) from a provided list of song names. If the list is empty, it attempts to load a playlist from `localStorage` under the key `musicPlayerSongs`. The songs are played in a mode determined by `playOrder`, which can be 'shuffle' (random), 'alphabetical', or 'listed' (original order). Playback starts after a user interaction (click or VR entry). Control is handled via the left controller's X button (pause/resume) and Y button (skip to next), as well as the Space bar (pause/resume) and N key (next song) on keyboard.
 *
 * To Do:
 * - Allow user to specify a custom audio directory.
 * - Update docs description to include new options
 */
AFRAME.registerComponent("music-player", {
    schema: {
        songs: { type: "array", default: [] },
        playOrder: { type: "string", default: "shuffle" }, // options: 'shuffle', 'alphabetical', 'listed'
        loopMode: { type: "string", default: "maintain" }, // options: 'maintain', 'shuffle', 'disable'
        controlsEnabled: { type: "boolean", default: true },
        togglePauseSelector: { type: "string", default: "#left-hand" },
        togglePauseBtn: { type: "string", default: "xbuttonup" },
        togglePauseKey: { type: "string", default: "Space" },
        nextTrackSelector: { type: "string", default: "#left-hand" },
        nextTrackBtn: { type: "string", default: "ybuttonup" },
        nextTrackKey: { type: "string", default: "KeyN" },
    },
    init: function () {
        const sceneEl = this.el.sceneEl;
        // If controls are enabled, set up event listeners for controller and keyboard inputs
        if (this.data.controlsEnabled) {
            this.setupControllerListeners();
            this.setupKeyboardListeners();
        }
        // If no songs were provided via the component attribute, load from localStorage.
        if (this.data.songs.length === 0) {
            let storedSongs = localStorage.getItem("musicPlayerSongs");
            if (storedSongs) {
                try {
                    let parsedSongs = JSON.parse(storedSongs);
                    if (Array.isArray(parsedSongs) && parsedSongs.length > 0) {
                        this.data.songs = parsedSongs;
                    }
                } catch (e) {
                    console.warn("Error parsing musicPlayerSongs from localStorage", e);
                }
            }
        }
        if (this.data.songs.length === 0) {
            console.warn("No songs found for music-player");
            return;
        }
        this.currentPlaylist = this.generatePlaylist(this.data.songs.slice());
        this.originalPlaylist = this.currentPlaylist.slice(); // Store the original order for maintaining
        this.audio = new Audio();
        this.audio.addEventListener("ended", () => {
            this.playNextSong();
        });
        this.audio.addEventListener("error", (e) => {
            console.error("Error loading song: " + this.currentSong, e);
            this.playNextSong();
        });
        // Wait for either a user click or VR entry to start playback
        this.boundStartPlayback = this.startPlayback.bind(this);
        document.addEventListener("click", this.boundStartPlayback, { once: true });
        sceneEl.addEventListener("enter-vr", () => {
            if (AFRAME.utils.device.checkHeadsetConnected()) {
                console.log("VR entered, starting music playback");
                this.boundStartPlayback();
                // Remove the click listener since we've started playback
                document.removeEventListener("click", this.boundStartPlayback);
            }
        });
    },
    startPlayback: function () {
        this.playNextSong();
    },
    playNextSong: function () {
        // Handle looping the playlist based on loopMode
        if (this.currentPlaylist.length === 0) {
            // Don't loop if disabled "disable"
            if (this.data.loopMode === "disable") {
                return;
            // Shuffle each time it resets
            } else if (this.data.loopMode === "shuffle") {
                this.currentPlaylist = this.shuffle(this.data.songs.slice());
            // If "maintain" or fallback, keep the original shuffle order
            } else if (this.data.loopMode === "maintain") {
                this.currentPlaylist = this.originalPlaylist.slice();
            } else {
                console.warn(`Unexpected loopMode: "${this.data.loopMode}". Defaulting to "maintain".`);
                this.currentPlaylist = this.originalPlaylist.slice();
            }
        }
        let nextSong = this.currentPlaylist.pop();
        // Remove any leading/trailing quotes individually
        nextSong = nextSong.trim();
        if (nextSong.startsWith("'")) nextSong = nextSong.slice(1);
        if (nextSong.endsWith("'")) nextSong = nextSong.slice(0, -1);
        this.currentSong = nextSong;
        console.log("Playing: " + nextSong);
        // URL encode to handle spaces and special characters
        this.audio.src = "assets/audio/music/" + encodeURI(nextSong);
        this.audio.play();
    },
    // Toggle pause/resume
    togglePause: function () {
        if (this.audio.paused) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
    },
    // Skip to next track
    nextTrack: function () {
        this.playNextSong();
    },
    shuffle: function (array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    generatePlaylist: function (songs) {
        switch (this.data.playOrder) {
            case "alphabetical":
                return songs.sort().reverse();
            case "listed":
                return songs.reverse();
            case "shuffle":
            default:
                return this.shuffle(songs);
        }
    },
    setupControllerListeners: function () {
        // Toggle Pause Controller Button
        const pauseControllerEl = document.querySelector(this.data.togglePauseSelector);
        if (pauseControllerEl) {
            pauseControllerEl.addEventListener(this.data.togglePauseBtn, () => this.togglePause());
        } else {
            console.warn("Controller not found:", this.data.togglePauseSelector);
        }
        // Next Track Controller Button
        const nextControllerEl = document.querySelector(this.data.nextTrackSelector);
        if (nextControllerEl) {
            nextControllerEl.addEventListener(this.data.nextTrackBtn, () => this.nextTrack());
        } else {
            console.warn("Controller not found:", this.data.nextTrackSelector);
        }
    },
    setupKeyboardListeners: function () {
        // Keyboard Events
        document.addEventListener("keyup", (e) => {
            if (e.code === this.data.togglePauseKey) {
                this.togglePause();
            } else if (e.code === this.data.nextTrackKey) {
                this.nextTrack();
            }
        });
    },
});
