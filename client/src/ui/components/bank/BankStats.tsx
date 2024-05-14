import useBankStore from "@/hooks/store/useBankStore";
import { divideByPrecision } from "@/ui/utils/utils";

type BankStatsProps = {};

export const BankStats = ({}: BankStatsProps): JSX.Element => {
  const bankStats = useBankStore((state) => state.bankStats);
  const {
    ownerTotalLordsFees,
    ownerTotalResourceFees,
    poolTotalLordsFees,
    poolTotalResourceFees,
    dailyClosingPriceResults,
  } = bankStats;

  return (
    <table>
      <tbody>
        <tr>
          <td>Owner Fees:</td>
          <td>{divideByPrecision(ownerTotalLordsFees)} $LORDS</td>
        </tr>
        <tr>
          <td>Pool Fees:</td>
          <td>{divideByPrecision(poolTotalLordsFees)} $LORDS</td>
        </tr>
      </tbody>
    </table>
  );
};
