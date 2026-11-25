/**
 * SMART LIBRARY - JECRC UNIVERSITY
 * Chart.js Visualizations & Analytics Engine
 */

(function(window) {
  'use strict';

  class LibraryChartsManager {
    constructor(store) {
      this.store = store;
      this.charts = {};
      this.colors = {
        navy: '#0f2a4a',
        blue: '#2563eb',
        lightBlue: 'rgba(37, 99, 235, 0.15)',
        green: '#059669',
        lightGreen: 'rgba(5, 150, 105, 0.15)',
        gold: '#d97706',
        purple: '#7c3aed',
        departments: [
          '#1e3a8a', '#0d9488', '#b45309', '#4338ca', '#047857',
          '#6d28d9', '#0369a1', '#be123c', '#4d7c0f'
        ]
      };
    }

    async initCharts() {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet.');
        return;
      }

      const analyticsData = await this.store.getAnalytics();
      this.renderDailyTrend(analyticsData.daily);
      this.renderHourlyTrend(analyticsData.hourly);
      this.renderDepartmentShare(analyticsData.department);
      this.renderAvgDuration(analyticsData.department);
    }

    async updateCharts() {
      if (typeof Chart === 'undefined') return;
      const analyticsData = await this.store.getAnalytics();

      if (this.charts.daily) {
        this.charts.daily.data.labels = analyticsData.daily.labels;
        this.charts.daily.data.datasets[0].data = analyticsData.daily.data;
        this.charts.daily.update();
      }

      if (this.charts.hourly) {
        this.charts.hourly.data.labels = analyticsData.hourly.labels;
        this.charts.hourly.data.datasets[0].data = analyticsData.hourly.data;
        this.charts.hourly.update();
      }

      if (this.charts.department) {
        this.charts.department.data.labels = analyticsData.department.labels;
        this.charts.department.data.datasets[0].data = analyticsData.department.data;
        this.charts.department.update();
      }

      if (this.charts.duration) {
        this.charts.duration.data.labels = analyticsData.department.labels;
        this.charts.duration.data.datasets[0].data = analyticsData.department.avg_duration || [];
        this.charts.duration.update();
      }
    }

    renderDailyTrend(daily) {
      const ctx = document.getElementById('chart-daily-trend');
      if (!ctx) return;

      if (this.charts.daily) this.charts.daily.destroy();

      this.charts.daily = new Chart(ctx, {
        type: 'line',
        data: {
          labels: daily.labels,
          datasets: [{
            label: 'Library Check-ins',
            data: daily.data,
            borderColor: this.colors.blue,
            backgroundColor: this.colors.lightBlue,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: this.colors.blue,
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              titleFont: { size: 12, weight: 'bold' },
              padding: 10,
              cornerRadius: 6
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b', font: { size: 11 } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#64748b', font: { size: 11 } }
            }
          }
        }
      });
    }

    renderHourlyTrend(hourly) {
      const ctx = document.getElementById('chart-hourly-trend');
      if (!ctx) return;

      if (this.charts.hourly) this.charts.hourly.destroy();

      this.charts.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: hourly.labels,
          datasets: [{
            label: 'Visitors per Hour',
            data: hourly.data,
            backgroundColor: '#3b82f6',
            borderRadius: 6,
            hoverBackgroundColor: '#1d4ed8'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              cornerRadius: 6
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b', font: { size: 11 } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 }
            }
          }
        }
      });
    }

    renderDepartmentShare(dept) {
      const ctx = document.getElementById('chart-dept-share');
      if (!ctx) return;

      if (this.charts.department) this.charts.department.destroy();

      this.charts.department = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: dept.labels,
          datasets: [{
            data: dept.data,
            backgroundColor: this.colors.departments.slice(0, dept.labels.length),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { boxWidth: 12, font: { size: 11 }, color: '#334155' }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              cornerRadius: 6
            }
          },
          cutout: '65%'
        }
      });
    }

    renderAvgDuration(dept) {
      const ctx = document.getElementById('chart-avg-duration');
      if (!ctx) return;

      if (this.charts.duration) this.charts.duration.destroy();

      this.charts.duration = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: dept.labels,
          datasets: [{
            label: 'Avg Duration (Minutes)',
            data: dept.avg_duration || [],
            backgroundColor: '#059669',
            borderRadius: 6,
            hoverBackgroundColor: '#047857'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              cornerRadius: 6
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b', font: { size: 11 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#64748b', font: { size: 10 } }
            }
          }
        }
      });
    }
  }

  window.LibraryChartsManager = LibraryChartsManager;
})(window);
