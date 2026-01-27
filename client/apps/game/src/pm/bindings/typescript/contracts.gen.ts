import { DojoCall, DojoProvider } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish } from "starknet";
import * as models from "./models.gen";

export function setupWorld(provider: DojoProvider) {

	const build_ConditionalTokens_balanceOf_calldata = (account: string, tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "balanceOf",
			calldata: [account, tokenId],
		};
	};

	const ConditionalTokens_balanceOf = async (account: string, tokenId: BigNumberish) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_balanceOf_calldata(account, tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_balanceOfBatch_calldata = (accounts: Array<string>, tokenIds: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "balanceOfBatch",
			calldata: [accounts, tokenIds],
		};
	};

	const ConditionalTokens_balanceOfBatch = async (accounts: Array<string>, tokenIds: Array<BigNumberish>) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_balanceOfBatch_calldata(accounts, tokenIds));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_getCollectionId_calldata = (parentCollectionId: BigNumberish, conditionId: BigNumberish, indexSet: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "get_collection_id",
			calldata: [parentCollectionId, conditionId, indexSet],
		};
	};

	const ConditionalTokens_getCollectionId = async (parentCollectionId: BigNumberish, conditionId: BigNumberish, indexSet: BigNumberish) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_getCollectionId_calldata(parentCollectionId, conditionId, indexSet));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_getConditionId_calldata = (oracle: string, questionId: BigNumberish, outcomeSlotCount: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "get_condition_id",
			calldata: [oracle, questionId, outcomeSlotCount],
		};
	};

	const ConditionalTokens_getConditionId = async (oracle: string, questionId: BigNumberish, outcomeSlotCount: BigNumberish) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_getConditionId_calldata(oracle, questionId, outcomeSlotCount));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_getOutcomeSlotCount_calldata = (conditionId: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "get_outcome_slot_count",
			calldata: [conditionId],
		};
	};

	const ConditionalTokens_getOutcomeSlotCount = async (snAccount: Account | AccountInterface, conditionId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_getOutcomeSlotCount_calldata(conditionId),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_getPositionId_calldata = (collateralToken: string, collectionId: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "get_position_id",
			calldata: [collateralToken, collectionId],
		};
	};

	const ConditionalTokens_getPositionId = async (collateralToken: string, collectionId: BigNumberish) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_getPositionId_calldata(collateralToken, collectionId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_isApprovedForAll_calldata = (owner: string, operator: string): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "isApprovedForAll",
			calldata: [owner, operator],
		};
	};

	const ConditionalTokens_isApprovedForAll = async (owner: string, operator: string) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_isApprovedForAll_calldata(owner, operator));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_mergePosition_calldata = (collateralToken: string, parentCollectionId: BigNumberish, conditionId: BigNumberish, partition: Array<BigNumberish>, amount: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "merge_position",
			calldata: [collateralToken, parentCollectionId, conditionId, partition, amount],
		};
	};

	const ConditionalTokens_mergePosition = async (snAccount: Account | AccountInterface, collateralToken: string, parentCollectionId: BigNumberish, conditionId: BigNumberish, partition: Array<BigNumberish>, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_mergePosition_calldata(collateralToken, parentCollectionId, conditionId, partition, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_name_calldata = (): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "name",
			calldata: [],
		};
	};

	const ConditionalTokens_name = async () => {
		try {
			return await provider.call("pm", build_ConditionalTokens_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_prepareCondition_calldata = (oracle: string, questionId: BigNumberish, outcomeSlotCount: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "prepare_condition",
			calldata: [oracle, questionId, outcomeSlotCount],
		};
	};

	const ConditionalTokens_prepareCondition = async (snAccount: Account | AccountInterface, oracle: string, questionId: BigNumberish, outcomeSlotCount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_prepareCondition_calldata(oracle, questionId, outcomeSlotCount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_redeemPositions_calldata = (collateralToken: string, parentCollectionId: BigNumberish, conditionId: BigNumberish, indexSets: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "redeem_positions",
			calldata: [collateralToken, parentCollectionId, conditionId, indexSets],
		};
	};

	const ConditionalTokens_redeemPositions = async (snAccount: Account | AccountInterface, collateralToken: string, parentCollectionId: BigNumberish, conditionId: BigNumberish, indexSets: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_redeemPositions_calldata(collateralToken, parentCollectionId, conditionId, indexSets),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_register_calldata = (): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "register",
			calldata: [],
		};
	};

	const ConditionalTokens_register = async (snAccount: Account | AccountInterface) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_register_calldata(),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_reportPayouts_calldata = (questionId: BigNumberish, payouts: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "report_payouts",
			calldata: [questionId, payouts],
		};
	};

	const ConditionalTokens_reportPayouts = async (snAccount: Account | AccountInterface, questionId: BigNumberish, payouts: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_reportPayouts_calldata(questionId, payouts),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_safeBatchTransferFrom_calldata = (from: string, to: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "safeBatchTransferFrom",
			calldata: [from, to, tokenIds, values, data],
		};
	};

	const ConditionalTokens_safeBatchTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_safeBatchTransferFrom_calldata(from, to, tokenIds, values, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_safeTransferFrom_calldata = (from: string, to: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "safeTransferFrom",
			calldata: [from, to, tokenId, value, data],
		};
	};

	const ConditionalTokens_safeTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_safeTransferFrom_calldata(from, to, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_setApprovalForAll_calldata = (operator: string, approved: boolean): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "setApprovalForAll",
			calldata: [operator, approved],
		};
	};

	const ConditionalTokens_setApprovalForAll = async (snAccount: Account | AccountInterface, operator: string, approved: boolean) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_setApprovalForAll_calldata(operator, approved),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_splitPosition_calldata = (collateralToken: string, parentCollectionId: BigNumberish, conditionId: BigNumberish, partition: Array<BigNumberish>, amount: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "split_position",
			calldata: [collateralToken, parentCollectionId, conditionId, partition, amount],
		};
	};

	const ConditionalTokens_splitPosition = async (snAccount: Account | AccountInterface, collateralToken: string, parentCollectionId: BigNumberish, conditionId: BigNumberish, partition: Array<BigNumberish>, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_splitPosition_calldata(collateralToken, parentCollectionId, conditionId, partition, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_supportsInterface_calldata = (interfaceId: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "supports_interface",
			calldata: [interfaceId],
		};
	};

	const ConditionalTokens_supportsInterface = async (interfaceId: BigNumberish) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_supportsInterface_calldata(interfaceId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_symbol_calldata = (): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const ConditionalTokens_symbol = async () => {
		try {
			return await provider.call("pm", build_ConditionalTokens_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_unsafeTransferFrom_calldata = (from: string, to: string, tokenId: BigNumberish, value: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "unsafe_transfer_from",
			calldata: [from, to, tokenId, value],
		};
	};

	const ConditionalTokens_unsafeTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenId: BigNumberish, value: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_ConditionalTokens_unsafeTransferFrom_calldata(from, to, tokenId, value),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_ConditionalTokens_uri_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "ConditionalTokens",
			entrypoint: "uri",
			calldata: [tokenId],
		};
	};

	const ConditionalTokens_uri = async (tokenId: BigNumberish) => {
		try {
			return await provider.call("pm", build_ConditionalTokens_uri_calldata(tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_assertCanResolve_calldata = (season: BigNumberish): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "assert_can_resolve",
			calldata: [season],
		};
	};

	const DojoOracleStorageMock_assertCanResolve = async (season: BigNumberish) => {
		try {
			return await provider.call("pm", build_DojoOracleStorageMock_assertCanResolve_calldata(season));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_getSeason_calldata = (): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "get_season",
			calldata: [],
		};
	};

	const DojoOracleStorageMock_getSeason = async () => {
		try {
			return await provider.call("pm", build_DojoOracleStorageMock_getSeason_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_getSeasonWinner_calldata = (season: BigNumberish): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "get_season_winner",
			calldata: [season],
		};
	};

	const DojoOracleStorageMock_getSeasonWinner = async (snAccount: Account | AccountInterface, season: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_DojoOracleStorageMock_getSeasonWinner_calldata(season),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_getValue_calldata = (marketId: BigNumberish): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "get_value",
			calldata: [marketId],
		};
	};

	const DojoOracleStorageMock_getValue = async (marketId: BigNumberish) => {
		try {
			return await provider.call("pm", build_DojoOracleStorageMock_getValue_calldata(marketId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_nextSeason_calldata = (): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "next_season",
			calldata: [],
		};
	};

	const DojoOracleStorageMock_nextSeason = async (snAccount: Account | AccountInterface) => {
		try {
			return await provider.execute(
				snAccount,
				build_DojoOracleStorageMock_nextSeason_calldata(),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_setSeasonWinner_calldata = (season: BigNumberish, winner: string): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "set_season_winner",
			calldata: [season, winner],
		};
	};

	const DojoOracleStorageMock_setSeasonWinner = async (snAccount: Account | AccountInterface, season: BigNumberish, winner: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_DojoOracleStorageMock_setSeasonWinner_calldata(season, winner),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracleStorageMock_setValue_calldata = (marketId: BigNumberish, value: BigNumberish): DojoCall => {
		return {
			contractName: "DojoOracleStorageMock",
			entrypoint: "set_value",
			calldata: [marketId, value],
		};
	};

	const DojoOracleStorageMock_setValue = async (snAccount: Account | AccountInterface, marketId: BigNumberish, value: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_DojoOracleStorageMock_setValue_calldata(marketId, value),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_abigenExtraParams_calldata = (params: models.DojoOracleExtraParams): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "abigen_extra_params",
			calldata: [params],
		};
	};

	const DojoOracle_abigenExtraParams = async (params: models.DojoOracleExtraParams) => {
		try {
			return await provider.call("pm", build_DojoOracle_abigenExtraParams_calldata(params));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_abigenParams_calldata = (params: models.DojoModelReader): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "abigen_params",
			calldata: [params],
		};
	};

	const DojoOracle_abigenParams = async (params: models.DojoModelReader) => {
		try {
			return await provider.call("pm", build_DojoOracle_abigenParams_calldata(params));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_assertValidCreateMarket_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "assert_valid_create_market",
			calldata: [createParams],
		};
	};

	const DojoOracle_assertValidCreateMarket = async (snAccount: Account | AccountInterface, createParams: models.CreateMarketParams) => {
		try {
			return await provider.execute(
				snAccount,
				build_DojoOracle_assertValidCreateMarket_calldata(createParams),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_description_calldata = (): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "description",
			calldata: [],
		};
	};

	const DojoOracle_description = async () => {
		try {
			return await provider.call("pm", build_DojoOracle_description_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_name_calldata = (): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "name",
			calldata: [],
		};
	};

	const DojoOracle_name = async () => {
		try {
			return await provider.call("pm", build_DojoOracle_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_oracleExtraParametersSchema_calldata = (): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "oracle_extra_parameters_schema",
			calldata: [],
		};
	};

	const DojoOracle_oracleExtraParametersSchema = async () => {
		try {
			return await provider.call("pm", build_DojoOracle_oracleExtraParametersSchema_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_oracleFee_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "oracle_fee",
			calldata: [createParams],
		};
	};

	const DojoOracle_oracleFee = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_DojoOracle_oracleFee_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_oracleParametersSchema_calldata = (): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "oracle_parameters_schema",
			calldata: [],
		};
	};

	const DojoOracle_oracleParametersSchema = async () => {
		try {
			return await provider.call("pm", build_DojoOracle_oracleParametersSchema_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_oracleValueType_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "oracle_value_type",
			calldata: [createParams],
		};
	};

	const DojoOracle_oracleValueType = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_DojoOracle_oracleValueType_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_resolve_calldata = (marketId: BigNumberish): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "resolve",
			calldata: [marketId],
		};
	};

	const DojoOracle_resolve = async (snAccount: Account | AccountInterface, marketId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_DojoOracle_resolve_calldata(marketId),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_terms_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "terms",
			calldata: [createParams],
		};
	};

	const DojoOracle_terms = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_DojoOracle_terms_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_DojoOracle_title_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "DojoOracle",
			entrypoint: "title",
			calldata: [createParams],
		};
	};

	const DojoOracle_title = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_DojoOracle_title_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboOracleExtensionMock_getPriceX128OverPeriod_calldata = (baseToken: string, quoteToken: string, startTime: BigNumberish, endTime: BigNumberish): DojoCall => {
		return {
			contractName: "EkuboOracleExtensionMock",
			entrypoint: "get_price_x128_over_period",
			calldata: [baseToken, quoteToken, startTime, endTime],
		};
	};

	const EkuboOracleExtensionMock_getPriceX128OverPeriod = async (baseToken: string, quoteToken: string, startTime: BigNumberish, endTime: BigNumberish) => {
		try {
			return await provider.call("pm", build_EkuboOracleExtensionMock_getPriceX128OverPeriod_calldata(baseToken, quoteToken, startTime, endTime));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboOracleExtensionMock_setPriceX128OverPeriod_calldata = (baseToken: string, quoteToken: string, startTime: BigNumberish, endTime: BigNumberish, price: BigNumberish): DojoCall => {
		return {
			contractName: "EkuboOracleExtensionMock",
			entrypoint: "set_price_x128_over_period",
			calldata: [baseToken, quoteToken, startTime, endTime, price],
		};
	};

	const EkuboOracleExtensionMock_setPriceX128OverPeriod = async (snAccount: Account | AccountInterface, baseToken: string, quoteToken: string, startTime: BigNumberish, endTime: BigNumberish, price: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_EkuboOracleExtensionMock_setPriceX128OverPeriod_calldata(baseToken, quoteToken, startTime, endTime, price),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_abigenParams_calldata = (params: models.EkuboOraclePriceX128OverPeriod): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "abigen_params",
			calldata: [params],
		};
	};

	const EkuboPriceOverPeriodOracle_abigenParams = async (params: models.EkuboOraclePriceX128OverPeriod) => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_abigenParams_calldata(params));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_assertValidCreateMarket_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "assert_valid_create_market",
			calldata: [createParams],
		};
	};

	const EkuboPriceOverPeriodOracle_assertValidCreateMarket = async (snAccount: Account | AccountInterface, createParams: models.CreateMarketParams) => {
		try {
			return await provider.execute(
				snAccount,
				build_EkuboPriceOverPeriodOracle_assertValidCreateMarket_calldata(createParams),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_description_calldata = (): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "description",
			calldata: [],
		};
	};

	const EkuboPriceOverPeriodOracle_description = async () => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_description_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_name_calldata = (): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "name",
			calldata: [],
		};
	};

	const EkuboPriceOverPeriodOracle_name = async () => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_oracleExtraParametersSchema_calldata = (): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "oracle_extra_parameters_schema",
			calldata: [],
		};
	};

	const EkuboPriceOverPeriodOracle_oracleExtraParametersSchema = async () => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_oracleExtraParametersSchema_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_oracleFee_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "oracle_fee",
			calldata: [createParams],
		};
	};

	const EkuboPriceOverPeriodOracle_oracleFee = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_oracleFee_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_oracleParametersSchema_calldata = (): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "oracle_parameters_schema",
			calldata: [],
		};
	};

	const EkuboPriceOverPeriodOracle_oracleParametersSchema = async () => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_oracleParametersSchema_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_oracleValueType_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "oracle_value_type",
			calldata: [createParams],
		};
	};

	const EkuboPriceOverPeriodOracle_oracleValueType = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_oracleValueType_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_resolve_calldata = (marketId: BigNumberish): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "resolve",
			calldata: [marketId],
		};
	};

	const EkuboPriceOverPeriodOracle_resolve = async (snAccount: Account | AccountInterface, marketId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_EkuboPriceOverPeriodOracle_resolve_calldata(marketId),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_terms_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "terms",
			calldata: [createParams],
		};
	};

	const EkuboPriceOverPeriodOracle_terms = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_terms_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_EkuboPriceOverPeriodOracle_title_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "EkuboPriceOverPeriodOracle",
			entrypoint: "title",
			calldata: [createParams],
		};
	};

	const EkuboPriceOverPeriodOracle_title = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_EkuboPriceOverPeriodOracle_title_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_buy_calldata = (marketId: BigNumberish, outcomeIndex: BigNumberish, amount: BigNumberish): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "buy",
			calldata: [marketId, outcomeIndex, amount],
		};
	};

	const Markets_buy = async (snAccount: Account | AccountInterface, marketId: BigNumberish, outcomeIndex: BigNumberish, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_buy_calldata(marketId, outcomeIndex, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_claimAddressFee_calldata = (tokenAddresses: Array<string>): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "claim_address_fee",
			calldata: [tokenAddresses],
		};
	};

	const Markets_claimAddressFee = async (snAccount: Account | AccountInterface, tokenAddresses: Array<string>) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_claimAddressFee_calldata(tokenAddresses),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_claimMarketFeeShare_calldata = (marketId: BigNumberish): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "claim_market_fee_share",
			calldata: [marketId],
		};
	};

	const Markets_claimMarketFeeShare = async (snAccount: Account | AccountInterface, marketId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_claimMarketFeeShare_calldata(marketId),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_claimProtocolFee_calldata = (tokenAddresses: Array<string>): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "claim_protocol_fee",
			calldata: [tokenAddresses],
		};
	};

	const Markets_claimProtocolFee = async (snAccount: Account | AccountInterface, tokenAddresses: Array<string>) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_claimProtocolFee_calldata(tokenAddresses),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_createMarket_calldata = (params: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "create_market",
			calldata: [params],
		};
	};

	const Markets_createMarket = async (snAccount: Account | AccountInterface, params: models.CreateMarketParams) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_createMarket_calldata(params),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_getOracle_calldata = (contractAddress: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "get_oracle",
			calldata: [contractAddress],
		};
	};

	const Markets_getOracle = async (contractAddress: string) => {
		try {
			return await provider.call("pm", build_Markets_getOracle_calldata(contractAddress));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_getRoleAdmin_calldata = (role: BigNumberish): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "get_role_admin",
			calldata: [role],
		};
	};

	const Markets_getRoleAdmin = async (role: BigNumberish) => {
		try {
			return await provider.call("pm", build_Markets_getRoleAdmin_calldata(role));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_getToken_calldata = (contractAddress: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "get_token",
			calldata: [contractAddress],
		};
	};

	const Markets_getToken = async (contractAddress: string) => {
		try {
			return await provider.call("pm", build_Markets_getToken_calldata(contractAddress));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_grantRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "grant_role",
			calldata: [role, account],
		};
	};

	const Markets_grantRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_grantRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_hasRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "has_role",
			calldata: [role, account],
		};
	};

	const Markets_hasRole = async (role: BigNumberish, account: string) => {
		try {
			return await provider.call("pm", build_Markets_hasRole_calldata(role, account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_isOracleRegistered_calldata = (contractAddress: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "is_oracle_registered",
			calldata: [contractAddress],
		};
	};

	const Markets_isOracleRegistered = async (contractAddress: string) => {
		try {
			return await provider.call("pm", build_Markets_isOracleRegistered_calldata(contractAddress));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_isPaused_calldata = (): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "is_paused",
			calldata: [],
		};
	};

	const Markets_isPaused = async () => {
		try {
			return await provider.call("pm", build_Markets_isPaused_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_isTokenRegistered_calldata = (contractAddress: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "is_token_registered",
			calldata: [contractAddress],
		};
	};

	const Markets_isTokenRegistered = async (contractAddress: string) => {
		try {
			return await provider.call("pm", build_Markets_isTokenRegistered_calldata(contractAddress));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_onErc1155BatchReceived_calldata = (operator: string, from: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "onERC1155BatchReceived",
			calldata: [operator, from, tokenIds, values, data],
		};
	};

	const Markets_onErc1155BatchReceived = async (operator: string, from: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>) => {
		try {
			return await provider.call("pm", build_Markets_onErc1155BatchReceived_calldata(operator, from, tokenIds, values, data));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_onErc1155Received_calldata = (operator: string, from: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "onERC1155Received",
			calldata: [operator, from, tokenId, value, data],
		};
	};

	const Markets_onErc1155Received = async (operator: string, from: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.call("pm", build_Markets_onErc1155Received_calldata(operator, from, tokenId, value, data));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_pause_calldata = (): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "pause",
			calldata: [],
		};
	};

	const Markets_pause = async (snAccount: Account | AccountInterface) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_pause_calldata(),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_redeem_calldata = (marketId: BigNumberish, allPositionsIds: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "redeem",
			calldata: [marketId, allPositionsIds],
		};
	};

	const Markets_redeem = async (snAccount: Account | AccountInterface, marketId: BigNumberish, allPositionsIds: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_redeem_calldata(marketId, allPositionsIds),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_registerOracle_calldata = (contractAddress: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "register_oracle",
			calldata: [contractAddress],
		};
	};

	const Markets_registerOracle = async (snAccount: Account | AccountInterface, contractAddress: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_registerOracle_calldata(contractAddress),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_registerToken_calldata = (contractAddress: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "register_token",
			calldata: [contractAddress],
		};
	};

	const Markets_registerToken = async (snAccount: Account | AccountInterface, contractAddress: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_registerToken_calldata(contractAddress),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_renounceRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "renounce_role",
			calldata: [role, account],
		};
	};

	const Markets_renounceRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_renounceRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_resolve_calldata = (marketId: BigNumberish): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "resolve",
			calldata: [marketId],
		};
	};

	const Markets_resolve = async (snAccount: Account | AccountInterface, marketId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_resolve_calldata(marketId),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_revokeRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "revoke_role",
			calldata: [role, account],
		};
	};

	const Markets_revokeRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_revokeRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_supportsInterface_calldata = (interfaceId: BigNumberish): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "supports_interface",
			calldata: [interfaceId],
		};
	};

	const Markets_supportsInterface = async (interfaceId: BigNumberish) => {
		try {
			return await provider.call("pm", build_Markets_supportsInterface_calldata(interfaceId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_Markets_unpause_calldata = (): DojoCall => {
		return {
			contractName: "Markets",
			entrypoint: "unpause",
			calldata: [],
		};
	};

	const Markets_unpause = async (snAccount: Account | AccountInterface) => {
		try {
			return await provider.execute(
				snAccount,
				build_Markets_unpause_calldata(),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_allowance_calldata = (owner: string, spender: string): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "allowance",
			calldata: [owner, spender],
		};
	};

	const MockLORDS_allowance = async (owner: string, spender: string) => {
		try {
			return await provider.call("pm", build_MockLORDS_allowance_calldata(owner, spender));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_approve_calldata = (spender: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "approve",
			calldata: [spender, amount],
		};
	};

	const MockLORDS_approve = async (snAccount: Account | AccountInterface, spender: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockLORDS_approve_calldata(spender, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_balanceOf_calldata = (account: string): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "balance_of",
			calldata: [account],
		};
	};

	const MockLORDS_balanceOf = async (account: string) => {
		try {
			return await provider.call("pm", build_MockLORDS_balanceOf_calldata(account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_decimals_calldata = (): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "decimals",
			calldata: [],
		};
	};

	const MockLORDS_decimals = async () => {
		try {
			return await provider.call("pm", build_MockLORDS_decimals_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_mint_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "mint",
			calldata: [recipient, amount],
		};
	};

	const MockLORDS_mint = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockLORDS_mint_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_name_calldata = (): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "name",
			calldata: [],
		};
	};

	const MockLORDS_name = async () => {
		try {
			return await provider.call("pm", build_MockLORDS_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_symbol_calldata = (): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const MockLORDS_symbol = async () => {
		try {
			return await provider.call("pm", build_MockLORDS_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_totalSupply_calldata = (): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "total_supply",
			calldata: [],
		};
	};

	const MockLORDS_totalSupply = async () => {
		try {
			return await provider.call("pm", build_MockLORDS_totalSupply_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_transfer_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "transfer",
			calldata: [recipient, amount],
		};
	};

	const MockLORDS_transfer = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockLORDS_transfer_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockLORDS_transferFrom_calldata = (sender: string, recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockLORDS",
			entrypoint: "transfer_from",
			calldata: [sender, recipient, amount],
		};
	};

	const MockLORDS_transferFrom = async (snAccount: Account | AccountInterface, sender: string, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockLORDS_transferFrom_calldata(sender, recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_allowance_calldata = (owner: string, spender: string): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "allowance",
			calldata: [owner, spender],
		};
	};

	const MockTBTC_allowance = async (owner: string, spender: string) => {
		try {
			return await provider.call("pm", build_MockTBTC_allowance_calldata(owner, spender));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_approve_calldata = (spender: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "approve",
			calldata: [spender, amount],
		};
	};

	const MockTBTC_approve = async (snAccount: Account | AccountInterface, spender: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockTBTC_approve_calldata(spender, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_balanceOf_calldata = (account: string): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "balance_of",
			calldata: [account],
		};
	};

	const MockTBTC_balanceOf = async (account: string) => {
		try {
			return await provider.call("pm", build_MockTBTC_balanceOf_calldata(account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_decimals_calldata = (): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "decimals",
			calldata: [],
		};
	};

	const MockTBTC_decimals = async () => {
		try {
			return await provider.call("pm", build_MockTBTC_decimals_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_mint_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "mint",
			calldata: [recipient, amount],
		};
	};

	const MockTBTC_mint = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockTBTC_mint_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_name_calldata = (): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "name",
			calldata: [],
		};
	};

	const MockTBTC_name = async () => {
		try {
			return await provider.call("pm", build_MockTBTC_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_symbol_calldata = (): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const MockTBTC_symbol = async () => {
		try {
			return await provider.call("pm", build_MockTBTC_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_totalSupply_calldata = (): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "total_supply",
			calldata: [],
		};
	};

	const MockTBTC_totalSupply = async () => {
		try {
			return await provider.call("pm", build_MockTBTC_totalSupply_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_transfer_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "transfer",
			calldata: [recipient, amount],
		};
	};

	const MockTBTC_transfer = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockTBTC_transfer_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockTBTC_transferFrom_calldata = (sender: string, recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockTBTC",
			entrypoint: "transfer_from",
			calldata: [sender, recipient, amount],
		};
	};

	const MockTBTC_transferFrom = async (snAccount: Account | AccountInterface, sender: string, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockTBTC_transferFrom_calldata(sender, recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_allowance_calldata = (owner: string, spender: string): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "allowance",
			calldata: [owner, spender],
		};
	};

	const MockUSDC_allowance = async (owner: string, spender: string) => {
		try {
			return await provider.call("pm", build_MockUSDC_allowance_calldata(owner, spender));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_approve_calldata = (spender: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "approve",
			calldata: [spender, amount],
		};
	};

	const MockUSDC_approve = async (snAccount: Account | AccountInterface, spender: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockUSDC_approve_calldata(spender, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_balanceOf_calldata = (account: string): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "balance_of",
			calldata: [account],
		};
	};

	const MockUSDC_balanceOf = async (account: string) => {
		try {
			return await provider.call("pm", build_MockUSDC_balanceOf_calldata(account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_decimals_calldata = (): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "decimals",
			calldata: [],
		};
	};

	const MockUSDC_decimals = async () => {
		try {
			return await provider.call("pm", build_MockUSDC_decimals_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_mint_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "mint",
			calldata: [recipient, amount],
		};
	};

	const MockUSDC_mint = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockUSDC_mint_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_name_calldata = (): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "name",
			calldata: [],
		};
	};

	const MockUSDC_name = async () => {
		try {
			return await provider.call("pm", build_MockUSDC_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_symbol_calldata = (): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const MockUSDC_symbol = async () => {
		try {
			return await provider.call("pm", build_MockUSDC_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_totalSupply_calldata = (): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "total_supply",
			calldata: [],
		};
	};

	const MockUSDC_totalSupply = async () => {
		try {
			return await provider.call("pm", build_MockUSDC_totalSupply_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_transfer_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "transfer",
			calldata: [recipient, amount],
		};
	};

	const MockUSDC_transfer = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockUSDC_transfer_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockUSDC_transferFrom_calldata = (sender: string, recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockUSDC",
			entrypoint: "transfer_from",
			calldata: [sender, recipient, amount],
		};
	};

	const MockUSDC_transferFrom = async (snAccount: Account | AccountInterface, sender: string, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockUSDC_transferFrom_calldata(sender, recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_allowance_calldata = (owner: string, spender: string): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "allowance",
			calldata: [owner, spender],
		};
	};

	const MockWBTC_allowance = async (owner: string, spender: string) => {
		try {
			return await provider.call("pm", build_MockWBTC_allowance_calldata(owner, spender));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_approve_calldata = (spender: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "approve",
			calldata: [spender, amount],
		};
	};

	const MockWBTC_approve = async (snAccount: Account | AccountInterface, spender: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockWBTC_approve_calldata(spender, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_balanceOf_calldata = (account: string): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "balance_of",
			calldata: [account],
		};
	};

	const MockWBTC_balanceOf = async (account: string) => {
		try {
			return await provider.call("pm", build_MockWBTC_balanceOf_calldata(account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_decimals_calldata = (): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "decimals",
			calldata: [],
		};
	};

	const MockWBTC_decimals = async () => {
		try {
			return await provider.call("pm", build_MockWBTC_decimals_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_mint_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "mint",
			calldata: [recipient, amount],
		};
	};

	const MockWBTC_mint = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockWBTC_mint_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_name_calldata = (): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "name",
			calldata: [],
		};
	};

	const MockWBTC_name = async () => {
		try {
			return await provider.call("pm", build_MockWBTC_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_symbol_calldata = (): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const MockWBTC_symbol = async () => {
		try {
			return await provider.call("pm", build_MockWBTC_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_totalSupply_calldata = (): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "total_supply",
			calldata: [],
		};
	};

	const MockWBTC_totalSupply = async () => {
		try {
			return await provider.call("pm", build_MockWBTC_totalSupply_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_transfer_calldata = (recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "transfer",
			calldata: [recipient, amount],
		};
	};

	const MockWBTC_transfer = async (snAccount: Account | AccountInterface, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockWBTC_transfer_calldata(recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_MockWBTC_transferFrom_calldata = (sender: string, recipient: string, amount: BigNumberish): DojoCall => {
		return {
			contractName: "MockWBTC",
			entrypoint: "transfer_from",
			calldata: [sender, recipient, amount],
		};
	};

	const MockWBTC_transferFrom = async (snAccount: Account | AccountInterface, sender: string, recipient: string, amount: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_MockWBTC_transferFrom_calldata(sender, recipient, amount),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_abigenExtraParams_calldata = (params: models.StarknetOracleExtraParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "abigen_extra_params",
			calldata: [params],
		};
	};

	const StarknetOracle_abigenExtraParams = async (params: models.StarknetOracleExtraParams) => {
		try {
			return await provider.call("pm", build_StarknetOracle_abigenExtraParams_calldata(params));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_abigenParams_calldata = (params: models.StarknetOracleParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "abigen_params",
			calldata: [params],
		};
	};

	const StarknetOracle_abigenParams = async (params: models.StarknetOracleParams) => {
		try {
			return await provider.call("pm", build_StarknetOracle_abigenParams_calldata(params));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_assertValidCreateMarket_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "assert_valid_create_market",
			calldata: [createParams],
		};
	};

	const StarknetOracle_assertValidCreateMarket = async (snAccount: Account | AccountInterface, createParams: models.CreateMarketParams) => {
		try {
			return await provider.execute(
				snAccount,
				build_StarknetOracle_assertValidCreateMarket_calldata(createParams),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_description_calldata = (): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "description",
			calldata: [],
		};
	};

	const StarknetOracle_description = async () => {
		try {
			return await provider.call("pm", build_StarknetOracle_description_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_name_calldata = (): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "name",
			calldata: [],
		};
	};

	const StarknetOracle_name = async () => {
		try {
			return await provider.call("pm", build_StarknetOracle_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_oracleExtraParametersSchema_calldata = (): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "oracle_extra_parameters_schema",
			calldata: [],
		};
	};

	const StarknetOracle_oracleExtraParametersSchema = async () => {
		try {
			return await provider.call("pm", build_StarknetOracle_oracleExtraParametersSchema_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_oracleFee_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "oracle_fee",
			calldata: [createParams],
		};
	};

	const StarknetOracle_oracleFee = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_StarknetOracle_oracleFee_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_oracleParametersSchema_calldata = (): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "oracle_parameters_schema",
			calldata: [],
		};
	};

	const StarknetOracle_oracleParametersSchema = async () => {
		try {
			return await provider.call("pm", build_StarknetOracle_oracleParametersSchema_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_oracleValueType_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "oracle_value_type",
			calldata: [createParams],
		};
	};

	const StarknetOracle_oracleValueType = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_StarknetOracle_oracleValueType_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_resolve_calldata = (marketId: BigNumberish): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "resolve",
			calldata: [marketId],
		};
	};

	const StarknetOracle_resolve = async (snAccount: Account | AccountInterface, marketId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_StarknetOracle_resolve_calldata(marketId),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_terms_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "terms",
			calldata: [createParams],
		};
	};

	const StarknetOracle_terms = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_StarknetOracle_terms_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_StarknetOracle_title_calldata = (createParams: models.CreateMarketParams): DojoCall => {
		return {
			contractName: "StarknetOracle",
			entrypoint: "title",
			calldata: [createParams],
		};
	};

	const StarknetOracle_title = async (createParams: models.CreateMarketParams) => {
		try {
			return await provider.call("pm", build_StarknetOracle_title_calldata(createParams));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_balanceOf_calldata = (account: string, tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "balance_of",
			calldata: [account, tokenId],
		};
	};

	const VaultFees_balanceOf = async (account: string, tokenId: BigNumberish) => {
		try {
			return await provider.call("pm", build_VaultFees_balanceOf_calldata(account, tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_balanceOfBatch_calldata = (accounts: Array<string>, tokenIds: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "balance_of_batch",
			calldata: [accounts, tokenIds],
		};
	};

	const VaultFees_balanceOfBatch = async (accounts: Array<string>, tokenIds: Array<BigNumberish>) => {
		try {
			return await provider.call("pm", build_VaultFees_balanceOfBatch_calldata(accounts, tokenIds));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_burn_calldata = (account: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "burn",
			calldata: [account, tokenId, value, data],
		};
	};

	const VaultFees_burn = async (snAccount: Account | AccountInterface, account: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_burn_calldata(account, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_getRoleAdmin_calldata = (role: BigNumberish): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "get_role_admin",
			calldata: [role],
		};
	};

	const VaultFees_getRoleAdmin = async (role: BigNumberish) => {
		try {
			return await provider.call("pm", build_VaultFees_getRoleAdmin_calldata(role));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_grantRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "grant_role",
			calldata: [role, account],
		};
	};

	const VaultFees_grantRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_grantRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_hasRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "has_role",
			calldata: [role, account],
		};
	};

	const VaultFees_hasRole = async (role: BigNumberish, account: string) => {
		try {
			return await provider.call("pm", build_VaultFees_hasRole_calldata(role, account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_isApprovedForAll_calldata = (owner: string, operator: string): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "is_approved_for_all",
			calldata: [owner, operator],
		};
	};

	const VaultFees_isApprovedForAll = async (owner: string, operator: string) => {
		try {
			return await provider.call("pm", build_VaultFees_isApprovedForAll_calldata(owner, operator));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_mint_calldata = (recipient: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "mint",
			calldata: [recipient, tokenId, value, data],
		};
	};

	const VaultFees_mint = async (snAccount: Account | AccountInterface, recipient: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_mint_calldata(recipient, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_name_calldata = (): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "name",
			calldata: [],
		};
	};

	const VaultFees_name = async () => {
		try {
			return await provider.call("pm", build_VaultFees_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_renounceRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "renounce_role",
			calldata: [role, account],
		};
	};

	const VaultFees_renounceRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_renounceRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_revokeRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "revoke_role",
			calldata: [role, account],
		};
	};

	const VaultFees_revokeRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_revokeRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_safeBatchTransferFrom_calldata = (from: string, to: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "safe_batch_transfer_from",
			calldata: [from, to, tokenIds, values, data],
		};
	};

	const VaultFees_safeBatchTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_safeBatchTransferFrom_calldata(from, to, tokenIds, values, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_safeTransferFrom_calldata = (from: string, to: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "safe_transfer_from",
			calldata: [from, to, tokenId, value, data],
		};
	};

	const VaultFees_safeTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_safeTransferFrom_calldata(from, to, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_setApprovalForAll_calldata = (operator: string, approved: boolean): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "set_approval_for_all",
			calldata: [operator, approved],
		};
	};

	const VaultFees_setApprovalForAll = async (snAccount: Account | AccountInterface, operator: string, approved: boolean) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_setApprovalForAll_calldata(operator, approved),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_symbol_calldata = (): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const VaultFees_symbol = async () => {
		try {
			return await provider.call("pm", build_VaultFees_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_unsafeTransferFrom_calldata = (from: string, to: string, tokenId: BigNumberish, value: BigNumberish): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "unsafe_transfer_from",
			calldata: [from, to, tokenId, value],
		};
	};

	const VaultFees_unsafeTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenId: BigNumberish, value: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultFees_unsafeTransferFrom_calldata(from, to, tokenId, value),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultFees_uri_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "VaultFees",
			entrypoint: "uri",
			calldata: [tokenId],
		};
	};

	const VaultFees_uri = async (tokenId: BigNumberish) => {
		try {
			return await provider.call("pm", build_VaultFees_uri_calldata(tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_balanceOf_calldata = (account: string, tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "balance_of",
			calldata: [account, tokenId],
		};
	};

	const VaultPositions_balanceOf = async (account: string, tokenId: BigNumberish) => {
		try {
			return await provider.call("pm", build_VaultPositions_balanceOf_calldata(account, tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_balanceOfBatch_calldata = (accounts: Array<string>, tokenIds: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "balance_of_batch",
			calldata: [accounts, tokenIds],
		};
	};

	const VaultPositions_balanceOfBatch = async (accounts: Array<string>, tokenIds: Array<BigNumberish>) => {
		try {
			return await provider.call("pm", build_VaultPositions_balanceOfBatch_calldata(accounts, tokenIds));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_burn_calldata = (account: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "burn",
			calldata: [account, tokenId, value, data],
		};
	};

	const VaultPositions_burn = async (snAccount: Account | AccountInterface, account: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_burn_calldata(account, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_getRoleAdmin_calldata = (role: BigNumberish): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "get_role_admin",
			calldata: [role],
		};
	};

	const VaultPositions_getRoleAdmin = async (role: BigNumberish) => {
		try {
			return await provider.call("pm", build_VaultPositions_getRoleAdmin_calldata(role));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_grantRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "grant_role",
			calldata: [role, account],
		};
	};

	const VaultPositions_grantRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_grantRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_hasRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "has_role",
			calldata: [role, account],
		};
	};

	const VaultPositions_hasRole = async (role: BigNumberish, account: string) => {
		try {
			return await provider.call("pm", build_VaultPositions_hasRole_calldata(role, account));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_isApprovedForAll_calldata = (owner: string, operator: string): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "is_approved_for_all",
			calldata: [owner, operator],
		};
	};

	const VaultPositions_isApprovedForAll = async (owner: string, operator: string) => {
		try {
			return await provider.call("pm", build_VaultPositions_isApprovedForAll_calldata(owner, operator));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_mint_calldata = (recipient: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "mint",
			calldata: [recipient, tokenId, value, data],
		};
	};

	const VaultPositions_mint = async (snAccount: Account | AccountInterface, recipient: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_mint_calldata(recipient, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_name_calldata = (): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "name",
			calldata: [],
		};
	};

	const VaultPositions_name = async () => {
		try {
			return await provider.call("pm", build_VaultPositions_name_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_renounceRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "renounce_role",
			calldata: [role, account],
		};
	};

	const VaultPositions_renounceRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_renounceRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_revokeRole_calldata = (role: BigNumberish, account: string): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "revoke_role",
			calldata: [role, account],
		};
	};

	const VaultPositions_revokeRole = async (snAccount: Account | AccountInterface, role: BigNumberish, account: string) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_revokeRole_calldata(role, account),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_safeBatchTransferFrom_calldata = (from: string, to: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "safe_batch_transfer_from",
			calldata: [from, to, tokenIds, values, data],
		};
	};

	const VaultPositions_safeBatchTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenIds: Array<BigNumberish>, values: Array<BigNumberish>, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_safeBatchTransferFrom_calldata(from, to, tokenIds, values, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_safeTransferFrom_calldata = (from: string, to: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "safe_transfer_from",
			calldata: [from, to, tokenId, value, data],
		};
	};

	const VaultPositions_safeTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenId: BigNumberish, value: BigNumberish, data: Array<BigNumberish>) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_safeTransferFrom_calldata(from, to, tokenId, value, data),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_setApprovalForAll_calldata = (operator: string, approved: boolean): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "set_approval_for_all",
			calldata: [operator, approved],
		};
	};

	const VaultPositions_setApprovalForAll = async (snAccount: Account | AccountInterface, operator: string, approved: boolean) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_setApprovalForAll_calldata(operator, approved),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_symbol_calldata = (): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "symbol",
			calldata: [],
		};
	};

	const VaultPositions_symbol = async () => {
		try {
			return await provider.call("pm", build_VaultPositions_symbol_calldata());
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_unsafeTransferFrom_calldata = (from: string, to: string, tokenId: BigNumberish, value: BigNumberish): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "unsafe_transfer_from",
			calldata: [from, to, tokenId, value],
		};
	};

	const VaultPositions_unsafeTransferFrom = async (snAccount: Account | AccountInterface, from: string, to: string, tokenId: BigNumberish, value: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_VaultPositions_unsafeTransferFrom_calldata(from, to, tokenId, value),
				"pm",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_VaultPositions_uri_calldata = (tokenId: BigNumberish): DojoCall => {
		return {
			contractName: "VaultPositions",
			entrypoint: "uri",
			calldata: [tokenId],
		};
	};

	const VaultPositions_uri = async (tokenId: BigNumberish) => {
		try {
			return await provider.call("pm", build_VaultPositions_uri_calldata(tokenId));
		} catch (error) {
			console.error(error);
			throw error;
		}
	};



	return {
		ConditionalTokens: {
			balanceOf: ConditionalTokens_balanceOf,
			buildBalanceOfCalldata: build_ConditionalTokens_balanceOf_calldata,
			balanceOfBatch: ConditionalTokens_balanceOfBatch,
			buildBalanceOfBatchCalldata: build_ConditionalTokens_balanceOfBatch_calldata,
			getCollectionId: ConditionalTokens_getCollectionId,
			buildGetCollectionIdCalldata: build_ConditionalTokens_getCollectionId_calldata,
			getConditionId: ConditionalTokens_getConditionId,
			buildGetConditionIdCalldata: build_ConditionalTokens_getConditionId_calldata,
			getOutcomeSlotCount: ConditionalTokens_getOutcomeSlotCount,
			buildGetOutcomeSlotCountCalldata: build_ConditionalTokens_getOutcomeSlotCount_calldata,
			getPositionId: ConditionalTokens_getPositionId,
			buildGetPositionIdCalldata: build_ConditionalTokens_getPositionId_calldata,
			isApprovedForAll: ConditionalTokens_isApprovedForAll,
			buildIsApprovedForAllCalldata: build_ConditionalTokens_isApprovedForAll_calldata,
			mergePosition: ConditionalTokens_mergePosition,
			buildMergePositionCalldata: build_ConditionalTokens_mergePosition_calldata,
			name: ConditionalTokens_name,
			buildNameCalldata: build_ConditionalTokens_name_calldata,
			prepareCondition: ConditionalTokens_prepareCondition,
			buildPrepareConditionCalldata: build_ConditionalTokens_prepareCondition_calldata,
			redeemPositions: ConditionalTokens_redeemPositions,
			buildRedeemPositionsCalldata: build_ConditionalTokens_redeemPositions_calldata,
			register: ConditionalTokens_register,
			buildRegisterCalldata: build_ConditionalTokens_register_calldata,
			reportPayouts: ConditionalTokens_reportPayouts,
			buildReportPayoutsCalldata: build_ConditionalTokens_reportPayouts_calldata,
			safeBatchTransferFrom: ConditionalTokens_safeBatchTransferFrom,
			buildSafeBatchTransferFromCalldata: build_ConditionalTokens_safeBatchTransferFrom_calldata,
			safeTransferFrom: ConditionalTokens_safeTransferFrom,
			buildSafeTransferFromCalldata: build_ConditionalTokens_safeTransferFrom_calldata,
			setApprovalForAll: ConditionalTokens_setApprovalForAll,
			buildSetApprovalForAllCalldata: build_ConditionalTokens_setApprovalForAll_calldata,
			splitPosition: ConditionalTokens_splitPosition,
			buildSplitPositionCalldata: build_ConditionalTokens_splitPosition_calldata,
			supportsInterface: ConditionalTokens_supportsInterface,
			buildSupportsInterfaceCalldata: build_ConditionalTokens_supportsInterface_calldata,
			symbol: ConditionalTokens_symbol,
			buildSymbolCalldata: build_ConditionalTokens_symbol_calldata,
			unsafeTransferFrom: ConditionalTokens_unsafeTransferFrom,
			buildUnsafeTransferFromCalldata: build_ConditionalTokens_unsafeTransferFrom_calldata,
			uri: ConditionalTokens_uri,
			buildUriCalldata: build_ConditionalTokens_uri_calldata,
		},
		DojoOracleStorageMock: {
			assertCanResolve: DojoOracleStorageMock_assertCanResolve,
			buildAssertCanResolveCalldata: build_DojoOracleStorageMock_assertCanResolve_calldata,
			getSeason: DojoOracleStorageMock_getSeason,
			buildGetSeasonCalldata: build_DojoOracleStorageMock_getSeason_calldata,
			getSeasonWinner: DojoOracleStorageMock_getSeasonWinner,
			buildGetSeasonWinnerCalldata: build_DojoOracleStorageMock_getSeasonWinner_calldata,
			getValue: DojoOracleStorageMock_getValue,
			buildGetValueCalldata: build_DojoOracleStorageMock_getValue_calldata,
			nextSeason: DojoOracleStorageMock_nextSeason,
			buildNextSeasonCalldata: build_DojoOracleStorageMock_nextSeason_calldata,
			setSeasonWinner: DojoOracleStorageMock_setSeasonWinner,
			buildSetSeasonWinnerCalldata: build_DojoOracleStorageMock_setSeasonWinner_calldata,
			setValue: DojoOracleStorageMock_setValue,
			buildSetValueCalldata: build_DojoOracleStorageMock_setValue_calldata,
		},
		DojoOracle: {
			abigenExtraParams: DojoOracle_abigenExtraParams,
			buildAbigenExtraParamsCalldata: build_DojoOracle_abigenExtraParams_calldata,
			abigenParams: DojoOracle_abigenParams,
			buildAbigenParamsCalldata: build_DojoOracle_abigenParams_calldata,
			assertValidCreateMarket: DojoOracle_assertValidCreateMarket,
			buildAssertValidCreateMarketCalldata: build_DojoOracle_assertValidCreateMarket_calldata,
			description: DojoOracle_description,
			buildDescriptionCalldata: build_DojoOracle_description_calldata,
			name: DojoOracle_name,
			buildNameCalldata: build_DojoOracle_name_calldata,
			oracleExtraParametersSchema: DojoOracle_oracleExtraParametersSchema,
			buildOracleExtraParametersSchemaCalldata: build_DojoOracle_oracleExtraParametersSchema_calldata,
			oracleFee: DojoOracle_oracleFee,
			buildOracleFeeCalldata: build_DojoOracle_oracleFee_calldata,
			oracleParametersSchema: DojoOracle_oracleParametersSchema,
			buildOracleParametersSchemaCalldata: build_DojoOracle_oracleParametersSchema_calldata,
			oracleValueType: DojoOracle_oracleValueType,
			buildOracleValueTypeCalldata: build_DojoOracle_oracleValueType_calldata,
			resolve: DojoOracle_resolve,
			buildResolveCalldata: build_DojoOracle_resolve_calldata,
			terms: DojoOracle_terms,
			buildTermsCalldata: build_DojoOracle_terms_calldata,
			title: DojoOracle_title,
			buildTitleCalldata: build_DojoOracle_title_calldata,
		},
		EkuboOracleExtensionMock: {
			getPriceX128OverPeriod: EkuboOracleExtensionMock_getPriceX128OverPeriod,
			buildGetPriceX128OverPeriodCalldata: build_EkuboOracleExtensionMock_getPriceX128OverPeriod_calldata,
			setPriceX128OverPeriod: EkuboOracleExtensionMock_setPriceX128OverPeriod,
			buildSetPriceX128OverPeriodCalldata: build_EkuboOracleExtensionMock_setPriceX128OverPeriod_calldata,
		},
		EkuboPriceOverPeriodOracle: {
			abigenParams: EkuboPriceOverPeriodOracle_abigenParams,
			buildAbigenParamsCalldata: build_EkuboPriceOverPeriodOracle_abigenParams_calldata,
			assertValidCreateMarket: EkuboPriceOverPeriodOracle_assertValidCreateMarket,
			buildAssertValidCreateMarketCalldata: build_EkuboPriceOverPeriodOracle_assertValidCreateMarket_calldata,
			description: EkuboPriceOverPeriodOracle_description,
			buildDescriptionCalldata: build_EkuboPriceOverPeriodOracle_description_calldata,
			name: EkuboPriceOverPeriodOracle_name,
			buildNameCalldata: build_EkuboPriceOverPeriodOracle_name_calldata,
			oracleExtraParametersSchema: EkuboPriceOverPeriodOracle_oracleExtraParametersSchema,
			buildOracleExtraParametersSchemaCalldata: build_EkuboPriceOverPeriodOracle_oracleExtraParametersSchema_calldata,
			oracleFee: EkuboPriceOverPeriodOracle_oracleFee,
			buildOracleFeeCalldata: build_EkuboPriceOverPeriodOracle_oracleFee_calldata,
			oracleParametersSchema: EkuboPriceOverPeriodOracle_oracleParametersSchema,
			buildOracleParametersSchemaCalldata: build_EkuboPriceOverPeriodOracle_oracleParametersSchema_calldata,
			oracleValueType: EkuboPriceOverPeriodOracle_oracleValueType,
			buildOracleValueTypeCalldata: build_EkuboPriceOverPeriodOracle_oracleValueType_calldata,
			resolve: EkuboPriceOverPeriodOracle_resolve,
			buildResolveCalldata: build_EkuboPriceOverPeriodOracle_resolve_calldata,
			terms: EkuboPriceOverPeriodOracle_terms,
			buildTermsCalldata: build_EkuboPriceOverPeriodOracle_terms_calldata,
			title: EkuboPriceOverPeriodOracle_title,
			buildTitleCalldata: build_EkuboPriceOverPeriodOracle_title_calldata,
		},
		Markets: {
			buy: Markets_buy,
			buildBuyCalldata: build_Markets_buy_calldata,
			claimAddressFee: Markets_claimAddressFee,
			buildClaimAddressFeeCalldata: build_Markets_claimAddressFee_calldata,
			claimMarketFeeShare: Markets_claimMarketFeeShare,
			buildClaimMarketFeeShareCalldata: build_Markets_claimMarketFeeShare_calldata,
			claimProtocolFee: Markets_claimProtocolFee,
			buildClaimProtocolFeeCalldata: build_Markets_claimProtocolFee_calldata,
			createMarket: Markets_createMarket,
			buildCreateMarketCalldata: build_Markets_createMarket_calldata,
			getOracle: Markets_getOracle,
			buildGetOracleCalldata: build_Markets_getOracle_calldata,
			getRoleAdmin: Markets_getRoleAdmin,
			buildGetRoleAdminCalldata: build_Markets_getRoleAdmin_calldata,
			getToken: Markets_getToken,
			buildGetTokenCalldata: build_Markets_getToken_calldata,
			grantRole: Markets_grantRole,
			buildGrantRoleCalldata: build_Markets_grantRole_calldata,
			hasRole: Markets_hasRole,
			buildHasRoleCalldata: build_Markets_hasRole_calldata,
			isOracleRegistered: Markets_isOracleRegistered,
			buildIsOracleRegisteredCalldata: build_Markets_isOracleRegistered_calldata,
			isPaused: Markets_isPaused,
			buildIsPausedCalldata: build_Markets_isPaused_calldata,
			isTokenRegistered: Markets_isTokenRegistered,
			buildIsTokenRegisteredCalldata: build_Markets_isTokenRegistered_calldata,
			onErc1155BatchReceived: Markets_onErc1155BatchReceived,
			buildOnErc1155BatchReceivedCalldata: build_Markets_onErc1155BatchReceived_calldata,
			onErc1155Received: Markets_onErc1155Received,
			buildOnErc1155ReceivedCalldata: build_Markets_onErc1155Received_calldata,
			pause: Markets_pause,
			buildPauseCalldata: build_Markets_pause_calldata,
			redeem: Markets_redeem,
			buildRedeemCalldata: build_Markets_redeem_calldata,
			registerOracle: Markets_registerOracle,
			buildRegisterOracleCalldata: build_Markets_registerOracle_calldata,
			registerToken: Markets_registerToken,
			buildRegisterTokenCalldata: build_Markets_registerToken_calldata,
			renounceRole: Markets_renounceRole,
			buildRenounceRoleCalldata: build_Markets_renounceRole_calldata,
			resolve: Markets_resolve,
			buildResolveCalldata: build_Markets_resolve_calldata,
			revokeRole: Markets_revokeRole,
			buildRevokeRoleCalldata: build_Markets_revokeRole_calldata,
			supportsInterface: Markets_supportsInterface,
			buildSupportsInterfaceCalldata: build_Markets_supportsInterface_calldata,
			unpause: Markets_unpause,
			buildUnpauseCalldata: build_Markets_unpause_calldata,
		},
		MockLORDS: {
			allowance: MockLORDS_allowance,
			buildAllowanceCalldata: build_MockLORDS_allowance_calldata,
			approve: MockLORDS_approve,
			buildApproveCalldata: build_MockLORDS_approve_calldata,
			balanceOf: MockLORDS_balanceOf,
			buildBalanceOfCalldata: build_MockLORDS_balanceOf_calldata,
			decimals: MockLORDS_decimals,
			buildDecimalsCalldata: build_MockLORDS_decimals_calldata,
			mint: MockLORDS_mint,
			buildMintCalldata: build_MockLORDS_mint_calldata,
			name: MockLORDS_name,
			buildNameCalldata: build_MockLORDS_name_calldata,
			symbol: MockLORDS_symbol,
			buildSymbolCalldata: build_MockLORDS_symbol_calldata,
			totalSupply: MockLORDS_totalSupply,
			buildTotalSupplyCalldata: build_MockLORDS_totalSupply_calldata,
			transfer: MockLORDS_transfer,
			buildTransferCalldata: build_MockLORDS_transfer_calldata,
			transferFrom: MockLORDS_transferFrom,
			buildTransferFromCalldata: build_MockLORDS_transferFrom_calldata,
		},
		MockTBTC: {
			allowance: MockTBTC_allowance,
			buildAllowanceCalldata: build_MockTBTC_allowance_calldata,
			approve: MockTBTC_approve,
			buildApproveCalldata: build_MockTBTC_approve_calldata,
			balanceOf: MockTBTC_balanceOf,
			buildBalanceOfCalldata: build_MockTBTC_balanceOf_calldata,
			decimals: MockTBTC_decimals,
			buildDecimalsCalldata: build_MockTBTC_decimals_calldata,
			mint: MockTBTC_mint,
			buildMintCalldata: build_MockTBTC_mint_calldata,
			name: MockTBTC_name,
			buildNameCalldata: build_MockTBTC_name_calldata,
			symbol: MockTBTC_symbol,
			buildSymbolCalldata: build_MockTBTC_symbol_calldata,
			totalSupply: MockTBTC_totalSupply,
			buildTotalSupplyCalldata: build_MockTBTC_totalSupply_calldata,
			transfer: MockTBTC_transfer,
			buildTransferCalldata: build_MockTBTC_transfer_calldata,
			transferFrom: MockTBTC_transferFrom,
			buildTransferFromCalldata: build_MockTBTC_transferFrom_calldata,
		},
		MockUSDC: {
			allowance: MockUSDC_allowance,
			buildAllowanceCalldata: build_MockUSDC_allowance_calldata,
			approve: MockUSDC_approve,
			buildApproveCalldata: build_MockUSDC_approve_calldata,
			balanceOf: MockUSDC_balanceOf,
			buildBalanceOfCalldata: build_MockUSDC_balanceOf_calldata,
			decimals: MockUSDC_decimals,
			buildDecimalsCalldata: build_MockUSDC_decimals_calldata,
			mint: MockUSDC_mint,
			buildMintCalldata: build_MockUSDC_mint_calldata,
			name: MockUSDC_name,
			buildNameCalldata: build_MockUSDC_name_calldata,
			symbol: MockUSDC_symbol,
			buildSymbolCalldata: build_MockUSDC_symbol_calldata,
			totalSupply: MockUSDC_totalSupply,
			buildTotalSupplyCalldata: build_MockUSDC_totalSupply_calldata,
			transfer: MockUSDC_transfer,
			buildTransferCalldata: build_MockUSDC_transfer_calldata,
			transferFrom: MockUSDC_transferFrom,
			buildTransferFromCalldata: build_MockUSDC_transferFrom_calldata,
		},
		MockWBTC: {
			allowance: MockWBTC_allowance,
			buildAllowanceCalldata: build_MockWBTC_allowance_calldata,
			approve: MockWBTC_approve,
			buildApproveCalldata: build_MockWBTC_approve_calldata,
			balanceOf: MockWBTC_balanceOf,
			buildBalanceOfCalldata: build_MockWBTC_balanceOf_calldata,
			decimals: MockWBTC_decimals,
			buildDecimalsCalldata: build_MockWBTC_decimals_calldata,
			mint: MockWBTC_mint,
			buildMintCalldata: build_MockWBTC_mint_calldata,
			name: MockWBTC_name,
			buildNameCalldata: build_MockWBTC_name_calldata,
			symbol: MockWBTC_symbol,
			buildSymbolCalldata: build_MockWBTC_symbol_calldata,
			totalSupply: MockWBTC_totalSupply,
			buildTotalSupplyCalldata: build_MockWBTC_totalSupply_calldata,
			transfer: MockWBTC_transfer,
			buildTransferCalldata: build_MockWBTC_transfer_calldata,
			transferFrom: MockWBTC_transferFrom,
			buildTransferFromCalldata: build_MockWBTC_transferFrom_calldata,
		},
		StarknetOracle: {
			abigenExtraParams: StarknetOracle_abigenExtraParams,
			buildAbigenExtraParamsCalldata: build_StarknetOracle_abigenExtraParams_calldata,
			abigenParams: StarknetOracle_abigenParams,
			buildAbigenParamsCalldata: build_StarknetOracle_abigenParams_calldata,
			assertValidCreateMarket: StarknetOracle_assertValidCreateMarket,
			buildAssertValidCreateMarketCalldata: build_StarknetOracle_assertValidCreateMarket_calldata,
			description: StarknetOracle_description,
			buildDescriptionCalldata: build_StarknetOracle_description_calldata,
			name: StarknetOracle_name,
			buildNameCalldata: build_StarknetOracle_name_calldata,
			oracleExtraParametersSchema: StarknetOracle_oracleExtraParametersSchema,
			buildOracleExtraParametersSchemaCalldata: build_StarknetOracle_oracleExtraParametersSchema_calldata,
			oracleFee: StarknetOracle_oracleFee,
			buildOracleFeeCalldata: build_StarknetOracle_oracleFee_calldata,
			oracleParametersSchema: StarknetOracle_oracleParametersSchema,
			buildOracleParametersSchemaCalldata: build_StarknetOracle_oracleParametersSchema_calldata,
			oracleValueType: StarknetOracle_oracleValueType,
			buildOracleValueTypeCalldata: build_StarknetOracle_oracleValueType_calldata,
			resolve: StarknetOracle_resolve,
			buildResolveCalldata: build_StarknetOracle_resolve_calldata,
			terms: StarknetOracle_terms,
			buildTermsCalldata: build_StarknetOracle_terms_calldata,
			title: StarknetOracle_title,
			buildTitleCalldata: build_StarknetOracle_title_calldata,
		},
		VaultFees: {
			balanceOf: VaultFees_balanceOf,
			buildBalanceOfCalldata: build_VaultFees_balanceOf_calldata,
			balanceOfBatch: VaultFees_balanceOfBatch,
			buildBalanceOfBatchCalldata: build_VaultFees_balanceOfBatch_calldata,
			burn: VaultFees_burn,
			buildBurnCalldata: build_VaultFees_burn_calldata,
			getRoleAdmin: VaultFees_getRoleAdmin,
			buildGetRoleAdminCalldata: build_VaultFees_getRoleAdmin_calldata,
			grantRole: VaultFees_grantRole,
			buildGrantRoleCalldata: build_VaultFees_grantRole_calldata,
			hasRole: VaultFees_hasRole,
			buildHasRoleCalldata: build_VaultFees_hasRole_calldata,
			isApprovedForAll: VaultFees_isApprovedForAll,
			buildIsApprovedForAllCalldata: build_VaultFees_isApprovedForAll_calldata,
			mint: VaultFees_mint,
			buildMintCalldata: build_VaultFees_mint_calldata,
			name: VaultFees_name,
			buildNameCalldata: build_VaultFees_name_calldata,
			renounceRole: VaultFees_renounceRole,
			buildRenounceRoleCalldata: build_VaultFees_renounceRole_calldata,
			revokeRole: VaultFees_revokeRole,
			buildRevokeRoleCalldata: build_VaultFees_revokeRole_calldata,
			safeBatchTransferFrom: VaultFees_safeBatchTransferFrom,
			buildSafeBatchTransferFromCalldata: build_VaultFees_safeBatchTransferFrom_calldata,
			safeTransferFrom: VaultFees_safeTransferFrom,
			buildSafeTransferFromCalldata: build_VaultFees_safeTransferFrom_calldata,
			setApprovalForAll: VaultFees_setApprovalForAll,
			buildSetApprovalForAllCalldata: build_VaultFees_setApprovalForAll_calldata,
			symbol: VaultFees_symbol,
			buildSymbolCalldata: build_VaultFees_symbol_calldata,
			unsafeTransferFrom: VaultFees_unsafeTransferFrom,
			buildUnsafeTransferFromCalldata: build_VaultFees_unsafeTransferFrom_calldata,
			uri: VaultFees_uri,
			buildUriCalldata: build_VaultFees_uri_calldata,
		},
		VaultPositions: {
			balanceOf: VaultPositions_balanceOf,
			buildBalanceOfCalldata: build_VaultPositions_balanceOf_calldata,
			balanceOfBatch: VaultPositions_balanceOfBatch,
			buildBalanceOfBatchCalldata: build_VaultPositions_balanceOfBatch_calldata,
			burn: VaultPositions_burn,
			buildBurnCalldata: build_VaultPositions_burn_calldata,
			getRoleAdmin: VaultPositions_getRoleAdmin,
			buildGetRoleAdminCalldata: build_VaultPositions_getRoleAdmin_calldata,
			grantRole: VaultPositions_grantRole,
			buildGrantRoleCalldata: build_VaultPositions_grantRole_calldata,
			hasRole: VaultPositions_hasRole,
			buildHasRoleCalldata: build_VaultPositions_hasRole_calldata,
			isApprovedForAll: VaultPositions_isApprovedForAll,
			buildIsApprovedForAllCalldata: build_VaultPositions_isApprovedForAll_calldata,
			mint: VaultPositions_mint,
			buildMintCalldata: build_VaultPositions_mint_calldata,
			name: VaultPositions_name,
			buildNameCalldata: build_VaultPositions_name_calldata,
			renounceRole: VaultPositions_renounceRole,
			buildRenounceRoleCalldata: build_VaultPositions_renounceRole_calldata,
			revokeRole: VaultPositions_revokeRole,
			buildRevokeRoleCalldata: build_VaultPositions_revokeRole_calldata,
			safeBatchTransferFrom: VaultPositions_safeBatchTransferFrom,
			buildSafeBatchTransferFromCalldata: build_VaultPositions_safeBatchTransferFrom_calldata,
			safeTransferFrom: VaultPositions_safeTransferFrom,
			buildSafeTransferFromCalldata: build_VaultPositions_safeTransferFrom_calldata,
			setApprovalForAll: VaultPositions_setApprovalForAll,
			buildSetApprovalForAllCalldata: build_VaultPositions_setApprovalForAll_calldata,
			symbol: VaultPositions_symbol,
			buildSymbolCalldata: build_VaultPositions_symbol_calldata,
			unsafeTransferFrom: VaultPositions_unsafeTransferFrom,
			buildUnsafeTransferFromCalldata: build_VaultPositions_unsafeTransferFrom_calldata,
			uri: VaultPositions_uri,
			buildUriCalldata: build_VaultPositions_uri_calldata,
		},
	};
}