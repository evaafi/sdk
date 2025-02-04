import { Cell, OpenedContract, Sender } from '@ton/core';
import { delay } from '../utils/utils';
import { RewardUser } from './RewardUser';

export type ClaimRewardsConfig = {
    rewardUser: OpenedContract<RewardUser>;
    userSender: Sender;
};

export class EvaaOnchainRewards {
    constructor(readonly config: ClaimRewardsConfig) {}

    /**
     * Claims rewards for a user.
     * By default this function will try to deploy the RewardUser contract if it is not yet deployed.
     * If the RewardUser contract is already deployed, it will simply claim the rewards.
     * @param userRewardContract The RewardUser contract wrapper.
     * @param tryToDeploy Whether to try to deploy the RewardUser contract if it is not yet deployed.
     * @param maxRetries The maximum number of retries to attempt.
     * @param retryDelay The delay (in ms) between retries.
     * @returns true if claim succeeded, false otherwise.
     */
    async claimRewards(
        signedClaimMessage: Cell,
        tryToDeploy?: boolean,
        maxRetries: number = 3,
        retryDelay: number = 5000,
    ): Promise<boolean> {
        const { rewardUser, userSender } = this.config;
        // Helper function to handle deployment
        const tryDeploy = async (attempt: number = 0): Promise<boolean> => {
            try {
                await rewardUser.getData();
                return true;
            } catch (error) {
                if (attempt >= maxRetries) {
                    console.error('Max deployment retries reached');
                    return false;
                }

                try {
                    await rewardUser.sendDeploy(userSender);
                    await delay(retryDelay);
                    return await tryDeploy(attempt + 1);
                } catch (deployError) {
                    console.error(`Deployment attempt ${attempt + 1} failed:`, deployError);
                    await delay(retryDelay);
                    return await tryDeploy(attempt + 1);
                }
            }
        };

        // Helper function to handle claim
        const tryClaim = async (attempt: number = 0): Promise<boolean> => {
            try {
                await rewardUser.sendClaim(userSender, signedClaimMessage);
                return true;
            } catch (error) {
                if (attempt >= maxRetries) {
                    console.error('Max claim retries reached');
                    return false;
                }

                console.error(`Claim attempt ${attempt + 1} failed:`, error);
                await delay(retryDelay);
                return await tryClaim(attempt + 1);
            }
        };

        // First ensure contract is deployed
        if (tryToDeploy && !(await tryDeploy())) {
            console.error('Failed to deploy contract after multiple attempts');
            return false;
        }

        // Then attempt to claim rewards
        if (!(await tryClaim())) {
            console.error('Failed to claim rewards after multiple attempts');
            return false;
        }

        return true;
    }
}
