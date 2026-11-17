import { defineConfig } from 'vite';
import { resolve } from 'path';

const rootDir = import.meta.dirname;

export default defineConfig({
  plugins: [],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
      '@assets': resolve(rootDir, './assets')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        listings: resolve(rootDir, 'listings.html'),
        listing: resolve(rootDir, 'listing.html'),
        howItWorks: resolve(rootDir, 'how-it-works.html'),
        about: resolve(rootDir, 'about.html'),
        faq: resolve(rootDir, 'faq.html'),
        safety: resolve(rootDir, 'safety.html'),
        contact: resolve(rootDir, 'contact.html'),
        report: resolve(rootDir, 'report.html'),
        login: resolve(rootDir, 'auth/login.html'),
        register: resolve(rootDir, 'auth/register.html'),
        tenantDashboard: resolve(rootDir, 'dashboard/tenant.html'),
        landlordDashboard: resolve(rootDir, 'dashboard/landlord.html'),
        landlordAddListing: resolve(rootDir, 'dashboard/landlord-add.html'),
        landlordEditListing: resolve(rootDir, 'dashboard/landlord-edit.html'),
        landlordUnlocks: resolve(rootDir, 'dashboard/landlord-unlocks.html'),
        tenantSaved: resolve(rootDir, 'dashboard/tenant-saved.html'),
        tenantUnlocked: resolve(rootDir, 'dashboard/tenant-unlocked.html'),
        tenantCompare: resolve(rootDir, 'dashboard/tenant-compare.html'),
        tenantPayments: resolve(rootDir, 'dashboard/tenant-payments.html'),
        payment: resolve(rootDir, 'payment/pay.html'),
        paymentSuccess: resolve(rootDir, 'payment/success.html'),
        paymentProblem: resolve(rootDir, 'payment/problem.html'),
        adminDashboard: resolve(rootDir, 'admin/index.html'),
        adminDashboardMain: resolve(rootDir, 'admin/dashboard.html'),
        adminVerify: resolve(rootDir, 'admin/verify-landlords.html'),
        adminListings: resolve(rootDir, 'admin/listings.html'),
        adminReports: resolve(rootDir, 'admin/reports.html'),
        terms: resolve(rootDir, 'legal/terms.html'),
        privacy: resolve(rootDir, 'legal/privacy.html'),
        cookies: resolve(rootDir, 'legal/cookies.html'),
        dmca: resolve(rootDir, 'legal/dmca.html')
      }
    }
  }
});
