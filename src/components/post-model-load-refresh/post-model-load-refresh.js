/**
 * Refreshes raycasters and physics bodies after all models have loaded.
 *
 * This was created because when models have textures, there appears to be a race condition due to them taking longer to load, which causes raycasters and physics bodies to not be assigned properly. This fixes that issue by waiting for all models to load before first.
 */
AFRAME.registerComponent("post-model-load-refresh", {
    schema: {
        refreshRaycasters: {type: 'boolean', default: true},
        refreshPhysics: {type: 'boolean', default: true}
    },
    init: function () {
        /**
         * Refreshes everything once all models have loaded.
         */
        const checkAllLoaded = () => {
            // console.log(`Checking if all models loaded: ${loadedModels}/${modelsToLoad}`); // 🐞
            if (loadedModels === modelsToLoad) {
                if (this.data.refreshRaycasters) refreshRaycasters();
                if (this.data.refreshPhysics) refreshPhysicsBodies();
            }
        };

        /**
         * Refreshes all raycasters in the scene.
         */
        const refreshRaycasters = () => {
            document.querySelectorAll("[raycaster]").forEach((ray) => {
                ray.components.raycaster.refreshObjects();
            });
        };

        /**
         * Refreshes all placeholder physics bodies in the scene ("delayed-dynamic-body" and "delayed-static-body").
         */
        const refreshPhysicsBodies = () => {
            // Refresh dynamic bodies
            document.querySelectorAll("[delayed-dynamic-body]").forEach((el) => {
                const config = el.getAttribute("delayed-dynamic-body"); // Save config
                el.removeAttribute("delayed-dynamic-body"); // Remove the placeholder attribute
                el.setAttribute("dynamic-body", config); // Re-add it to refresh
            });
            // Refresh static bodies
            document.querySelectorAll("[delayed-static-body]").forEach((el) => {
                const config = el.getAttribute("delayed-static-body"); // Save config
                el.removeAttribute("delayed-static-body"); // Remove the placeholder attribute
                el.setAttribute("static-body", config); // Re-add it to refresh
            });
        };

        // Get all models in the scene that have a gltf-model component
        const models = document.querySelectorAll("[gltf-model]:not(a-mixin)");
        // console.log({ models }); // 🐞
        // Get array of models that have already loaded
        let loadedModels = Array.from(models).filter((el) => el.components?.["gltf-model"]?.model).length;
        const modelsToLoad = models.length;
        // If all models are already loaded, refresh immediately
        checkAllLoaded();
        // Listen for remaining models to load
        models.forEach((el) => {
            el.addEventListener("model-loaded", () => {
                loadedModels++;
                checkAllLoaded();
            });
        });
        // Force refresh if models don't load within 5 seconds
        setTimeout(() => {
            if (loadedModels < modelsToLoad) {
                console.warn(`Not all models loaded after 5 seconds (${loadedModels}/${modelsToLoad}). Forcing refresh anyway.`);
                if (this.data.refreshRaycasters) refreshRaycasters();
                if (this.data.refreshPhysics) refreshPhysicsBodies();
            }
        }, 5000);
    },
});
