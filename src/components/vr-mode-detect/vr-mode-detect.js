// Detect if the user is actually in VR
AFRAME.registerComponent("vr-mode-detect", {
    init: function () {
        const sceneEl = this.el.sceneEl; // Reference to the scene
        const reticle = document.getElementById("reticle");
        // Event listener for entering VR mode
        sceneEl?.addEventListener("enter-vr", function () {
            if (AFRAME.utils.device.checkHeadsetConnected()) {
                // Hide the reticle when in VR mode
                reticle?.setAttribute("visible", "false");
                // Disable cursor's raycasting
                reticle?.setAttribute("raycaster", "enabled", false);
            }
        });
        // Event listener for exiting VR mode
        sceneEl?.addEventListener("exit-vr", function () {
            // Show the reticle when not in VR mode
            reticle?.setAttribute("visible", "true");
            // Enable cursor's raycasting
            reticle?.setAttribute("raycaster", "enabled", true);
        });
    },
});
