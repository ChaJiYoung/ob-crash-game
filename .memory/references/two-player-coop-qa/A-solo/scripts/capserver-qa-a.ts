import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
const storePath = (process.argv[2] || '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/A-solo/data') + '/players.json';
createBeerCrusherServer({ port: 8801, storePath }).then((s) => console.log('capserver QA-A up on', s.port));
