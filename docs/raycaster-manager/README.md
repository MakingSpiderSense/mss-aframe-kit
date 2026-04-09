# raycaster-manager

## Overview

`raycaster-manager` is an A-Frame component designed to dynamically enable and disable raycasters attached to VR controllers. It ensures that only one controller's raycaster is active at a time and provides optional audio feedback when toggling. This component assumes a specific scene setup where:

- Controllers have the IDs `left-hand` and `right-hand`.
- Raycasters are children of the controllers with the class `actual-ray`.
- Styled visual rays are siblings to the raycasters with the class `styled-ray`.
- Raycasters are initially disabled by default.

_Tested with A-Frame 1.7.0._

**[Watch Demo](https://www.youtube.com/watch?v=5M6M5AuEHZk)**

[![View Demo](assets/demo-thumbnail.jpg)](https://www.youtube.com/watch?v=5M6M5AuEHZk)

**Have a headset? [Try it out in VR!](https://makingspidersense.github.io/mss-aframe-kit/raycaster-manager/example.html)**

## Example Usage

Add the `raycaster-manager` component to the scene to enable automatic raycaster management:

```html
<a-scene raycaster-manager>
    <a-entity id="left-hand" meta-touch-controls="hand: left">
        <a-entity class="styled-ray ar-left" visible="false" rotation="60 0 0" scale="1 1.5 1" sound="src: #raycaster-beep; volume: .1;">
            <a-cylinder position="0 -0.5 0" height="1" radius="0.002" color="#ffffff" opacity=".4"></a-cylinder>
        </a-entity>
        <a-entity class="actual-ray" rotation="-30 0 0"  raycaster="objects: .interactable; autoRefresh: false; enabled: false; far: 1.5; showLine: false; lineColor: red"></a-entity>
    </a-entity>
    <a-entity id="right-hand" meta-touch-controls="hand: right">
        <a-entity class="styled-ray ar-right" visible="false" rotation="60 0 0" scale="1 1.5 1" sound="src: #raycaster-beep; volume: .1;">
            <a-cylinder position="0 -0.5 0" height="1" radius="0.002" color="#ffffff" opacity=".4"></a-cylinder>
        </a-entity>
        <a-entity class="actual-ray" rotation="-30 0 0"  raycaster="objects: .interactable; autoRefresh: false; enabled: false; far: 1.5; showLine: false; lineColor: red"></a-entity>
    </a-entity>
</a-scene>
```

The `styled-ray` wrapper is anchored at the controller origin. To shorten or lengthen the visible beam without disconnecting it from the controller, adjust the wrapper's `scale` on the `y` axis. You can match it to the raycaster's `far` property for consistent visual feedback.

## How It Works

1. **Trigger Detection**: Listens for the `triggerdown` event on both controllers (`left-hand` and `right-hand`).
2. **Toggle Logic**:
   - If the raycaster is **already active** and not intersecting with an interactable object, it gets disabled.
   - If the raycaster is **inactive**, it gets enabled, and the other controller's raycaster is disabled.
3. **Visual and Audio Feedback**:
   - When enabled, the corresponding `styled-ray` is made visible.
   - If the `styled-ray` has a sound component, it plays an activation sound.

## Limitations

- It is not possible to have both raycasters active simultaneously.
- The component assumes a specifically named controllers and class-based raycaster organization.
- Initially, raycasters must be disabled; the component does not auto-detect their state at initialization.

---

Feel free to reach out to me at [Making Spider Sense](https://makingspidersense.com/contact/) for any questions!