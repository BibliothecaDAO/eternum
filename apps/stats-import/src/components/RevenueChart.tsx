import React, { useRef, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { RevenueChartProps, ColorScheme } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

const RevenueChart: React.FC<RevenueChartProps> = ({ revenueData, lordsPrice, totalLords }) => {
  const chartRef = useRef<ChartJS<'doughnut'> | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isSmallMobile, setIsSmallMobile] = useState<boolean>(false);

  // Hook to detect screen size
  useEffect(() => {
    const checkScreenSize = (): void => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsSmallMobile(width <= 480);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const colors: ColorScheme[] = [
    {
      background: 'rgba(240, 176, 96, 0.9)',
      border: '#f0b060',
      hover: 'rgba(240, 176, 96, 1)'
    },
    {
      background: 'rgba(223, 194, 150, 0.9)',
      border: '#dfc296',
      hover: 'rgba(223, 194, 150, 1)'
    },
    {
      background: 'rgba(192, 192, 192, 0.9)',
      border: '#c0c0c0',
      hover: 'rgba(192, 192, 192, 1)'
    },
    {
      background: 'rgba(166, 124, 0, 0.9)',
      border: '#a67c00',
      hover: 'rgba(166, 124, 0, 1)'
    }
  ];

  const data = {
    labels: revenueData.map(item => item.category),
    datasets: [{
      data: revenueData.map(item => item.amount),
      backgroundColor: colors.map(color => color.background),
      borderColor: colors.map(color => color.border),
      borderWidth: isMobile ? 2 : 3,
      hoverBorderWidth: isMobile ? 4 : 5,
      hoverBorderColor: '#ffffff',
      hoverBackgroundColor: colors.map(color => color.hover)
    }]
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: isMobile ? '55%' : '60%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(20, 15, 10, 0.95)',
        titleColor: '#f0b060',
        bodyColor: '#dfc296',
        borderColor: '#f0b060',
        borderWidth: 2,
        cornerRadius: 12,
        displayColors: false,
        titleFont: {
          size: isMobile ? 14 : 16,
          weight: 'bold'
        },
        bodyFont: {
          size: isMobile ? 12 : 14
        },
        padding: isMobile ? 8 : 12,
        callbacks: {
          title: function(context: TooltipItem<'doughnut'>[]) {
            return context[0].label || '';
          },
          label: function(context: TooltipItem<'doughnut'>) {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            const usdValue = Math.round(value * lordsPrice);
            
            // Mobile-friendly formatting
            const lordsFormatted = isMobile && value >= 1000 
              ? `${(value / 1000).toFixed(0)}K LORDS`
              : `${value.toLocaleString()} LORDS`;
            
            const usdFormatted = isMobile && usdValue >= 1000000
              ? `≈ $${(usdValue / 1000000).toFixed(1)}M USD`
              : `≈ $${usdValue.toLocaleString()} USD`;
            
            return [
              lordsFormatted,
              `${percentage}% of total revenue`,
              usdFormatted
            ];
          }
        }
      }
    },
    layout: {
      padding: isMobile ? 10 : 20
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: isMobile ? 1500 : 2000,
      easing: 'easeOutBounce'
    },
    onHover: (event, activeElements) => {
      const target = event.native?.target as HTMLElement;
      if (target) {
        target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
      }
      if (activeElements.length > 0) {
        setHoveredSegment(activeElements[0].index);
      } else {
        setHoveredSegment(null);
      }
    },
    // Enhanced touch/mobile interaction
    interaction: {
      intersect: !isMobile, // Allow easier touch interaction on mobile
      mode: isMobile ? 'nearest' : 'index'
    }
  };

  const handleLegendHover = (index: number, isHovering: boolean): void => {
    // Disable hover effects on mobile for better touch experience
    if (isMobile) return;
    
    const chart = chartRef.current;
    if (!chart) return;

    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((segment, i) => {
      if (isHovering) {
        if (i === index) {
          segment.options.borderWidth = 6;
          segment.options.hoverBorderWidth = 6;
        } else {
          segment.options.backgroundColor = segment.options.backgroundColor?.toString().replace('0.9', '0.3');
        }
      } else {
        segment.options.borderWidth = isMobile ? 2 : 3;
        segment.options.hoverBorderWidth = isMobile ? 4 : 5;
        segment.options.backgroundColor = colors[i].background;
      }
    });
    chart.update('none');
  };

  const handleLegendClick = (index: number): void => {
    const chart = chartRef.current;
    if (!chart) return;

    const meta = chart.getDatasetMeta(0);
    const segment = meta.data[index] as any;
    segment.hidden = !segment.hidden;
    chart.update();
    
    // Provide haptic feedback on mobile if available
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const formatUSD = (lordsAmount: number): string => {
    const usdValue = Math.round(lordsAmount * lordsPrice);
    return isMobile && usdValue >= 1000000
      ? `${(usdValue / 1000000).toFixed(1)}M`
      : usdValue.toLocaleString();
  };

  const formatLords = (amount: number): string => {
    return isSmallMobile && amount >= 1000
      ? `${(amount / 1000).toFixed(0)}K`
      : amount.toLocaleString();
  };

  const getTotalDisplayValue = (): string => {
    return isSmallMobile && totalLords >= 1000
      ? `${(totalLords / 1000).toFixed(0)}K`
      : totalLords.toLocaleString();
  };

  const getTotalLabel = (): string => {
    return isSmallMobile ? 'TOTAL' : 'TOTAL LORDS';
  };

  const getTotalUSDDisplay = (): string => {
    const usdValue = Math.round(totalLords * lordsPrice);
    if (isSmallMobile && usdValue >= 1000000) {
      return `≈ $${(usdValue / 1000000).toFixed(1)}M`;
    }
    return `≈ $${usdValue.toLocaleString()} USD`;
  };

  return (
    <div className="container">
      <h1>{isMobile ? 'Season 1 Revenue' : 'Season 1 Total Revenue Distribution'}</h1>
      
      <div className="chart-container">
        <div className="chart-wrapper">
          <div className="chart-canvas-wrapper">
            <Doughnut ref={chartRef} data={data} options={options} />
            <div className="center-text">
              <div className="total-amount">{getTotalDisplayValue()}</div>
              <div className="total-label">{getTotalLabel()}</div>
              <div className="total-usd">{getTotalUSDDisplay()}</div>
            </div>
          </div>
        </div>
        
        <div className="legend-container">
          {revenueData.map((item, index) => (
            <div 
              key={index}
              className="legend-item"
              onMouseEnter={() => handleLegendHover(index, true)}
              onMouseLeave={() => handleLegendHover(index, false)}
              onClick={() => handleLegendClick(index)}
              onTouchStart={() => handleLegendClick(index)} // Better touch support
              role="button"
              tabIndex={0}
              aria-label={`${item.category}: ${item.amount.toLocaleString()} LORDS`}
            >
              <div className="legend-item-left">
                <div className={`legend-color color-${index}`}></div>
                <div className="legend-info">
                  <div className="legend-title">
                    {isMobile && item.category.length > 15 
                      ? item.category.split(' ').slice(0, 2).join(' ')
                      : item.category
                    }
                  </div>
                  <div className="legend-subtitle">
                    {isMobile 
                      ? `${item.percentage}%`
                      : `${item.percentage}% of total revenue`
                    }
                  </div>
                </div>
              </div>
              <div className="legend-item-right">
                <div className="legend-amount">{formatLords(item.amount)}</div>
                <div className="legend-lords">{isSmallMobile ? '' : 'LORDS'}</div>
                <div className="legend-usd">≈ ${formatUSD(item.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RevenueChart; 