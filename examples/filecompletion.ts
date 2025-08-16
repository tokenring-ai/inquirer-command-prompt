import commandPrompt from "../index.js";

async function runPrompt(): Promise<void> {
  async function fileCompletion(): Promise<string[]> {
    return [
      "../dir/",
      "../dir/file",
      "../dir/file2",
      "../dir/file3",
      "../dir/folder/",
      "../bit/due",
      "../folder/",
      "./",
      "../",
    ];
  }

  const short = (l: string, m: string[]): string[] => {
    const res: string[] = [];
    if (l) {
      l = l.replace(/ $/, "");
      let r = l.split("/");
      if (r.length !== 1) {
        r.pop();
        r = [r.join("/") + "/"];
      } else {
        r = [l];
      }
      for (let i = 0; i < m.length; i++) {
        try {
          if (m[i] !== l) {
            const split = m[i].split(r[0]);
            m[i] = split[1];
            if (m[i]) {
              res.push(m[i]);
            }
          }
        } catch (e) {
          // Ignore errors in splitting
        }
      }
    }
    return res;
  };

  try {
    const answer = await commandPrompt({
      message: ">",
      autoCompletion: fileCompletion,
      validate: (val: string) => {
        return val ? true : "Press TAB for suggestions";
      },
      short,
    });

    if (answer !== "quit") {
      console.log(`You run ${answer}`);
      return runPrompt();
    }
  } catch (err) {
    console.error((err as Error).stack);
  }
}

// noinspection JSIgnoredPromiseFromCall
runPrompt();