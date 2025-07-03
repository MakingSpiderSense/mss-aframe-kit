# music-player

## Overview

`music-player` is an A-Frame component designed to provide a radio-like audio experience within VR scenes. It allows you to play a custom playlist of songs and includes support for VR controller buttons and keyboard input for playback control. Songs can be played in various orders and loop modes, making it ideal any experience that requires background playlist.

## Basic Usage

Attach the component to any entity in your scene and configure it with a playlist of audio files:

```html
<a-scene>
    <!-- Music Player -->
    <a-entity music-player="
        songs:
            'Track 01.mp3',
            'Track 02.mp3',
            'Track 03.mp3'
        ;
        playOrder: shuffle;
        audioDirectory: assets/audio/music/;
    "></a-entity>
</a-scene>
```

This will create a music player that plays the specified tracks in a shuffled order from the `assets/audio/music/` directory. Use the `Space` key to pause/play and the `N` key to skip to the next track. You can also use VR controller buttons for these actions - just be sure to specify the selector for the controller entity. By default, the `X` button on the left controller will toggle pause/play and the `Y` button will skip to the next track.

## Properties

| Parameter           | Type    | Description                                                | Default               | Options                             |
| ------------------- | ------- | ---------------------------------------------------------- | --------------------- | ----------------------------------- |
| songs               | Array   | List of song filenames to include in the playlist          |                       | Comma-separated audio file names    |
| playOrder           | String  | Determines the initial playback order                      | `shuffle`             | `shuffle`, `alphabetical`, `listed` |
| loopMode            | String  | Controls playlist looping behavior after it finishes       | `maintain`            | `maintain`, `shuffle`, `disable`    |
| audioDirectory      | String  | Path to the directory containing the audio files           | `assets/audio/music/` | Any valid relative path             |
| controlsEnabled     | Boolean | Enables VR controller and keyboard controls                | `true`                | `true`, `false`                     |
| togglePauseSelector | String  | Selector for the controller used to toggle pause/play      | `#left-hand`          | Any valid selector                  |
| togglePauseBtn      | String  | Controller button event for toggling pause/play            | `xbuttonup`           | e.g., `xbuttonup`, `abuttonup`      |
| togglePauseKey      | String  | Keyboard key code to toggle pause/play                     | `Space`               | e.g., `Space`, `KeyP`               |
| nextTrackSelector   | String  | Selector for the controller used to skip to the next track | `#left-hand`          | Any valid selector                  |
| nextTrackBtn        | String  | Controller button event for skipping tracks                | `ybuttonup`           | e.g., `ybuttonup`, `bbuttonup`      |
| nextTrackKey        | String  | Keyboard key code to skip to the next track                | `KeyN`                | e.g., `KeyN`, `ArrowRight`          |

## Limitations

- At this time, there is no way to go back to the previous track.

## Additional Notes

- The component uses HTML5 Audio and supports standard web audio file formats like `.mp3`, `.ogg`, etc.

---

Feel free to reach out to me at [Making Spider Sense](https://makingspidersense.com/contact/) for any questions!
