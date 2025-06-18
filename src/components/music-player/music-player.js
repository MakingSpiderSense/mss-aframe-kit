/**
 * Music Player Component
 *
 * Overview: A component that plays a shuffled playlist of songs, allowing control via VR controllers or keyboard input.
 *
 * Description: This component plays a series of audio files (such as MP3s) from a provided list of song names. If the list is empty, it attempts to load a playlist from `localStorage` under the key `musicPlayerSongs`. The songs are shuffled and played one by one, automatically advancing on song end or error. Playback starts after a user interaction (click or VR entry). Control is handled via the left controller's X button (pause/resume) and Y button (skip to next), as well as the Space bar (pause/resume) and N key (next song) on keyboard.
 *
 * To Do:
 * - Add ability to disable controls.
 * - Add ability to customize controls.
 * - Add loop controls (disable loop, reshuffle on loop, loop original shuffle order).
 * - Add ability to disable shuffle.
 * - Allow user to specify a custom audio directory.
 */
AFRAME.registerComponent("music-player", {
    schema: {
        songs: { type: "array", default: [] },
        shuffle: { type: "boolean", default: true },
    },
    init: function () {
        const sceneEl = this.el.sceneEl;
        const leftController = document.querySelector("#left-hand");
        // Error and return if no controller found
        if (!leftController) {
            console.error("No #left-hand controller found for music-player");
            return;
        }
        leftController.addEventListener("xbuttonup", () => this.togglePause());
        leftController.addEventListener("ybuttonup", () => this.nextTrack());
        // Add togglePause with Space bar key and nextTrack with N key
        document.addEventListener("keyup", (e) => {
            if (e.code === "Space") {
                this.togglePause();
            } else if (e.code === "KeyN") {
                this.nextTrack();
            }
        });
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
        this.currentPlaylist = this.data.shuffle ? this.shuffle(this.data.songs.slice()) : this.data.songs.slice();
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
        if (this.currentPlaylist.length === 0) {
            this.currentPlaylist = this.data.shuffle ? this.shuffle(this.data.songs.slice()) : this.data.songs.slice();
            console.log("Playlist resetting");
        }
        let nextSong = this.currentPlaylist.pop();
        // Remove any leading/trailing quotes individually
        nextSong = nextSong.trim();
        if (nextSong.startsWith("'")) {
            nextSong = nextSong.slice(1);
        }
        if (nextSong.endsWith("'")) {
            nextSong = nextSong.slice(0, -1);
        }
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
});
