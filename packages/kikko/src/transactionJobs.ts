import { acquireJob, IJob, IJobsState, releaseJob } from "./job";
import { ReactiveVar } from "./reactiveVar";
import { ITransactionOpts } from "./types";

export const acquireWithTrJobOrWait = async (
  jobsState: ReactiveVar<IJobsState>,
  transactionOpts?: ITransactionOpts
) => {
  let job: IJob | undefined;

  if (!transactionOpts || transactionOpts?.containsTransactionStart) {
    job = await acquireJob(jobsState, transactionOpts?.transactionId);
  }

  if (transactionOpts && !transactionOpts.containsTransactionStart) {
    await jobsState.waitTill(
      (state) => state.current?.id === transactionOpts.transactionId
    );
  }

  return job;
};

export const releaseTrJobIfPossible = (
  jobsState: ReactiveVar<IJobsState>,
  job: IJob | undefined,
  transactionOpts?: ITransactionOpts
) => {
  if (
    job &&
    (!transactionOpts ||
      transactionOpts?.containsTransactionFinish ||
      transactionOpts?.containsTransactionRollback)
  ) {
    releaseJob(jobsState, job);
  }

  if (
    !job &&
    transactionOpts &&
    (transactionOpts?.containsTransactionRollback ||
      transactionOpts?.containsTransactionFinish)
  ) {
    releaseJob(jobsState, { id: transactionOpts.transactionId });
  }
};
