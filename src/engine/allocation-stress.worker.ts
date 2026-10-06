import { runAllocationStress, type StressProgress } from "./allocation-stress";

// The full ladder stays off the UI thread, with each completed solve
// published immediately. Closing/cancelling the board terminates the worker.
const publish = (message: StressProgress): void => postMessage(message);
self.onmessage = () => {
  try {
    runAllocationStress((row) => publish({ row }));
    publish({ done: true });
  } catch (error) {
    publish({ error: error instanceof Error ? error.message : String(error) });
  }
};
