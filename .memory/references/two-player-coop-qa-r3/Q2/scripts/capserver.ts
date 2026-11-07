import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
const storePath = process.argv[2] || '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r3/Q2/data/players.json';
createBeerCrusherServer({ port: 8822, storePath }).then((s) => console.log('capserver Q2 up', s.port, storePath));
