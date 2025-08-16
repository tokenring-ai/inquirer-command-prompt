import commandPrompt from "../index.js";

async function runPrompt(): Promise<void> {
  const availableCommands: string[] = [
    "foo a",
    "foo b",
    "foo ba mike",
    "foo bb buck",
    "foo bb jick",
    "boo",
    "fuu",
    "quit",
    "show john [first option]",
    "show mike [second option]",
    "isb -b --aab-long -a optA",
    "isb -b --aab-long -a optB",
    "isb -b --aab-long -a optC",
  ];

  try {
    const answer = await commandPrompt({
      message: ">",
      autoCompletion: availableCommands,
      validate: (val: string) => {
        return val ? true : "Press TAB for suggestions";
      },
      short: true,
    });

    if (
      !["foo", "boo", "doo", "quit", "show"].some((cmd) =>
        answer.startsWith(cmd),
      )
    ) {
      console.log("Okedoke.");
    }

    if (answer !== "quit") {
      return runPrompt();
    }
  } catch (err) {
    console.error((err as Error).stack);
  }
}

// noinspection JSIgnoredPromiseFromCall
runPrompt();