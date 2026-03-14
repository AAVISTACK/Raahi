import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  console.log("No PORT set — exiting (build stage complete)");
  process.exit(0);
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  console.error(`Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
