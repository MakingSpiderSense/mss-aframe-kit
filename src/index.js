const components = import.meta.glob("./components/**/*.js", { eager: true });

console.log("MSS A-Frame Kit Loaded", components);

// Export helpers so they are available in the global scope
export * from "./components/_helpers/helpers.js";
