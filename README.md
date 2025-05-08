# MSS A-Frame Kit

## Overview

**mss-aframe-kit** is a collection of A-Frame components built for my projects. I've decided to make it public in case anyone else finds these extras useful in their own A-Frame scenes. While others are free to use it, I don't plan on providing active support for this project at this time and flexibility may be limited.

Each A-Frame component is maintained in its own folder under `src/components/`. Some components include their own README files with detailed documentation. Check the README.md file in each component's folder for more information. The project includes both minified and unminified builds in the `dist/` folder.

Tested up to **A-Frame 1.7.0**.

## Featured Components

- **[arm-swing-movement](#)** enables intuitive, full-body locomotion in VR by translating natural arm-swinging gestures into forward (or backward) movement. This component is ideal for VR experiences where you want users to physically feel like they're walking or jogging through the environment - without the need for specialized hardware like an omnidirectional treadmill. It uses the Z-axis reversal of each controller to detect "steps", dynamically calculates a target speed, and moves the player rig accordingly. It supports nav-mesh constrained movement, adjustable smoothing, speed limits, and even synchronized footstep sound playback for added realism.

## Conflicts

If a custom component shares a name with one from `mss-aframe-kit` and it's not needed, it can be removed before registering the new one. For example:

```javascript
delete AFRAME.components["holdable"];
```

## License

You are free to use *mss-aframe-kit* in your own projects.