import test from "ava";

export function loggerSetup() {
    test.beforeEach(t => {
        t.context.originalLog = console.log;
        t.context.originalWarn = console.warn;
        t.context.originalError = console.error;
        const whoops = () => { t.context.originalError("Whoops! Forgot to call setConsole(t)!") };
        console.log = whoops;
        console.warn = whoops;
        console.error = whoops; 
    });
    test.afterEach(t => {
        console.log = t.context.originalLog;
        console.warn = t.context.originalWarn;
        console.error = t.context.originalError;
    });
}

export function setConsole(t) {
    console.log = (...args) => t.log("LOG:", ...args),
    console.warn =  (...args) => t.log("WARN:", ...args),
    console.error = (...args) => t.log("ERROR:", ...args)
};