// VR Console Logger
AFRAME.registerComponent("vr-logger", {
    schema: {
        maxMessages: { type: "int", default: 5 }, // Maximum number of messages to display
    },
    // Initialize the component
    init: function () {
        const enableVrLogger = localStorage.getItem("enableVrLogger");
        if (!enableVrLogger || enableVrLogger !== "true") {
            console.log("VR Logger is disabled.");
            return;
        }
        this.messages = [];
        this.el.setAttribute("text", {
            color: "white",
            width: 3, // Width of the text box
            wrapCount: 45, // Number of characters per line before wrapping
            align: "left",
        });
        // Override the console.log function to capture and display messages in the VR console
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            originalConsoleLog(...args);
            // Add the console message to the array
            this.addMessage(args.map((a) => {
                if (a === null) return 'null';
                if (a === undefined) return 'undefined';
                return a.toString();
            }).join(" "));
        };
    },
    // Add a message to the console
    addMessage: function (message) {
        // Remove the oldest message if the array is full
        if (this.messages.length >= this.data.maxMessages) {
            this.messages.shift();
        }
        // Add the new message to the array
        this.messages.push(message + "\n");
        this.updateText();
    },
    // Update the text displayed in the VR console
    updateText: function () {
        this.el.setAttribute("text", "value", this.messages.join("\n"));
    },
});
