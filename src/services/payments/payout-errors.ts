// How a payout attempt failed decides what approveWithdrawal may do next,
// whatever the provider (paydunya-payout.ts today, bictorys-payout.ts
// before it):

// The provider explicitly refused, or the transfer was never submitted —
// no money can have left, the request can safely go back to review.
export class PayoutRejectedError extends Error {}

// The transfer may or may not have gone through (network failure, timeout,
// provider error after submission). Carries the provider's reference when
// one was obtained, so the real outcome can still be checked later instead
// of re-approving blindly.
export class PayoutUncertainError extends Error {
  constructor(
    message: string,
    readonly providerReference: string | null,
  ) {
    super(message);
  }
}
