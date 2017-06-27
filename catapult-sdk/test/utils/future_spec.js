import { expect } from 'chai';
import future from '../../src/utils/future';

describe('future', () => {
	describe('makeRetryable', () => {
		function makeRetryable(numRetries, futureSupplier, waitTimeSupplier) {
			const capture = {
				counts: {
					futureSupplier: 0,
					waitTimeSupplier: 0
				},
				waitTimeParams: []
			};

			return {
				capture,
				future: future.makeRetryable(
					() => futureSupplier(++capture.counts.futureSupplier),
					numRetries,
					(i, err) => {
						capture.waitTimeParams.push({ id: i, message: err.message });
						return waitTimeSupplier(++capture.counts.waitTimeSupplier);
					})
			};
		}

		it('does not retry if future succeeds on first attempt', () => {
			// Arrange:
			const state = makeRetryable(5, () => Promise.resolve(123), () => 7);
			const counts = state.capture.counts;

			// Act:
			return state.future.then(value => {
				// Assert:
				expect(counts.futureSupplier).to.equal(1);
				expect(counts.waitTimeSupplier).to.equal(0);
				expect(value).to.equal(123);
			});
		});

		it('fails if all retry attempts are exhausted', () => {
			// Arrange:
			const state = makeRetryable(5, id => Promise.reject(Error(`bad future ${id}`)), () => 7);
			const counts = state.capture.counts;

			// Act:
			return state.future
				.then(() => { throw Error('future unexpectedly succeded'); })
				.catch(err => {
					// Assert:
					expect(counts.futureSupplier).to.equal(5);
					expect(counts.waitTimeSupplier).to.equal(4);
					expect(err.message).to.equal('bad future 5');

					expect(state.capture.waitTimeParams).to.deep.equal([
						{ id: 1, message: 'bad future 1' },
						{ id: 2, message: 'bad future 2' },
						{ id: 3, message: 'bad future 3' },
						{ id: 4, message: 'bad future 4' }
					]);
				});
		});

		it('fails if all retry attempts are exhausted (maxAttempts === 1)', () => {
			// Arrange:
			const state = makeRetryable(1, id => Promise.reject(Error(`bad future ${id}`)), () => 7);
			const counts = state.capture.counts;

			// Act:
			return state.future
				.then(() => { throw Error('future unexpectedly succeded'); })
				.catch(err => {
					// Assert:
					expect(counts.futureSupplier).to.equal(1);
					expect(counts.waitTimeSupplier).to.equal(0);
					expect(err.message).to.equal('bad future 1');
				});
		});

		it('succeeds if some attempts failed but later attempt succeeded', () => {
			// Arrange:
			const state = makeRetryable(5, id => (3 === id ? Promise.resolve(123) : Promise.reject(Error(`bad future ${id}`))), () => 7);
			const counts = state.capture.counts;

			// Act:
			return state.future.then(value => {
				// Assert:
				expect(counts.futureSupplier).to.equal(3);
				expect(counts.waitTimeSupplier).to.equal(2);
				expect(value).to.equal(123);

				expect(state.capture.waitTimeParams).to.deep.equal([
					{ id: 1, message: 'bad future 1' },
					{ id: 2, message: 'bad future 2' }
				]);
			});
		});

		it('honors supplied wait time', () => {
			// Arrange:
			function createFutureSupplier(terminalValue) {
				return id => (4 === id ? Promise.resolve(terminalValue) : Promise.reject(Error(`bad future ${id}`)));
			}

			const state1 = makeRetryable(5, createFutureSupplier(111), id => id * id * 4); // 56:  4 + 16 + 36
			const state2 = makeRetryable(5, createFutureSupplier(222), id => id * 7);      // 42:  7 + 14 + 21
			const state3 = makeRetryable(5, createFutureSupplier(333), () => 20);          // 60: 20 + 20 + 20

			// Act:
			return Promise.race([state1.future, state2.future, state3.future]).then(value => {
				// Assert: the second future with the smallest cumulative wait should complete first
				expect(value).to.equal(222);
			});
		});
	});
});