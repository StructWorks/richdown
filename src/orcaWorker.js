// Orca plugin worker entrypoint (bundled to media/orcaWorker.mjs).
//
// Orca runs this in Node when the Richdown editor frame first asks it for
// something. The frame has no file system, so the worker finds the file the
// frame has open and reads the images the document shows. See
// orca-worker/richdownWorker.js for the requests it answers.
import { createRichdownWorker } from "./orca-worker/richdownWorker.js";

export default function activate(orca) {
  const worker = createRichdownWorker({ host: orca.host });
  orca.panels.handle("richdown.locateDocument", (input) => worker.locate(input));
  orca.panels.handle("richdown.readImage", (input) => worker.readImage(input));
}
