import test from "ava";
import {loggerSetup, setConsole} from "../helpers/loggerSetup";

loggerSetup();

// TODO: I never tested if adding/removing tags works correctly with queries!

test.skip("Filters work with relations", t => {
    t.fail();
});

test.skip("Can't access deleted entity through relation", t => {
    t.fail();
});

