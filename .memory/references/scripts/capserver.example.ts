import { createBeerCrusherServer } from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/server/wsServer';
createBeerCrusherServer({ port: 8799, storePath: process.argv[2] + '/players.json' }).then((s) => console.log('capserver up', s.port));
