import test from "ava";

export function loggerSetup() {
    test.beforeEach(t => {
        // @ts-ignore
        t.context.originalLog = console.log;
        // @ts-ignore
        t.context.originalWarn = console.warn;
        // @ts-ignore
        t.context.originalError = console.error;
        // @ts-ignore
        const whoops = () => { t.context.originalError("Whoops! Forgot to call setConsole(t)!") };
        console.log = whoops;
        console.warn = whoops;
        console.error = whoops; 
    });
    test.afterEach(t => {
        // @ts-ignore
        console.log = t.context.originalLog;
        // @ts-ignore
        console.warn = t.context.originalWarn;
        // @ts-ignore
        console.error = t.context.originalError;
    });
}

export function setConsole(t) {
    console.log = (...args) => t.log("LOG:", ...args),
    console.warn =  (...args) => t.log("WARN:", ...args),
    console.error = (...args) => t.log("ERROR:", ...args)
};