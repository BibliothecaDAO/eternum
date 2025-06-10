import React from 'react';
import { FeeTableProps, RevenueData } from '../types';

const FeeTable: React.FC<FeeTableProps> = ({ revenueData, lordsPrice }) => {
  const formatUSD = (lordsAmount: number): string => {
    return Math.round(lordsAmount * lordsPrice).toLocaleString();
  };

  const formatAddress = (address: string): React.JSX.Element => {
    if (address === 'No specific address') {
      return <span className="address no-address">{address}</span>;
    }
    if (address === 'Multiple wallets') {
      return <span className="address">{address}</span>;
    }
    return <span className="address">{address}</span>;
  };

  const renderBreakdown = (item: RevenueData): React.JSX.Element => {
    if (item.category === 'Bridge Fees') {
      return (
        <div className="source-breakdown">
          • Season Pool: 18,637 LORDS<br />
          &nbsp;&nbsp;<span style={{fontFamily: "'Monaco', 'Menlo', monospace", fontSize: '0.65rem', color: '#dfc296'}}>
            0x04cd21aa3e634e36d6379bdbb3fef78f7e0a882eb8a048624c4b02eead1bc553
          </span><br />
          • VeLords Bridge Fees: 18,637 LORDS<br />
          &nbsp;&nbsp;<span style={{fontFamily: "'Monaco', 'Menlo', monospace", fontSize: '0.65rem', color: '#dfc296'}}>
            0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5
          </span><br />
          • Client Integration: 18,008 LORDS<br />
          &nbsp;&nbsp;<span style={{fontFamily: "'Monaco', 'Menlo', monospace", fontSize: '0.65rem', color: '#dfc296'}}>
            0x009d838f2db23afd64e4a2a116eda44a00cda1b1c8cb2ce9c11eb534e8bc50e0
          </span>
        </div>
      );
    }
    return <div className="source-breakdown">{item.breakdown}</div>;
  };

  return (
    <div className="container">
      <h1>Fee Collection Summary</h1>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fee Category</th>
              <th>Wallet Address</th>
              <th>Amount Collected</th>
              <th>Revenue Source</th>
            </tr>
          </thead>
          <tbody>
            {revenueData.map((item, index) => (
              <tr key={index}>
                <td>
                  <div className="fee-category">{item.category}</div>
                  <div className="fee-description">{item.description}</div>
                </td>
                <td>
                  {formatAddress(item.address)}
                </td>
                <td className="amount">
                  {item.amount.toLocaleString()}
                  <span className="lords-badge">LORDS</span>
                  <div className="amount-usd">≈ ${formatUSD(item.amount)} USD</div>
                </td>
                <td className="source">
                  {item.source}
                  {renderBreakdown(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeeTable; 