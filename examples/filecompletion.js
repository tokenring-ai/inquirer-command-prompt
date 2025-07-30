import commandPrompt from "../index.js";

async function runPrompt() {
	async function fileCompletion() {
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

	const short = (l, m) => {
		const res = [];
		if (l) {
			l = l.replace(/ $/, "");
			let r = l.split("/");
			if (r.length !== 1) {
				r.pop();
				r = r.join("/") + "/";
			} else {
				r = l;
			}
			for (let i = 0; i < m.length; i++) {
				try {
					if (m[i] !== l) {
						m[i] = m[i].split(r)[1];
						if (m[i]) {
							res.push(m[i]);
						}
					}
				} catch (e) {}
			}
		}
		return res;
	};

	try {
		const answer = await commandPrompt({
			message: ">",
			autoCompletion: fileCompletion,
			context: "0",
			validate: (val) => {
				return val ? true : "Press TAB for suggestions";
			},
			short,
		});

		if (answer !== "quit") {
			console.log(`You run ${answer}`);
			return runPrompt();
		}
	} catch (err) {
		console.error(err.stack);
	}
}

runPrompt();
