import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    hmr: false,
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@assets': resolve(__dirname, './assets')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        listings: resolve(__dirname, 'listings.html'),
        listing: resolve(__dirname, 'listing.html'),
        howItWorks: resolve(__dirname, 'how-it-works.html'),
        about: resolve(__dirname, 'about.html'),
        faq: resolve(__dirname, 'faq.html'),
        safety: resolve(__dirname, 'safety.html'),
        contact: resolve(__dirname, 'contact.html'),
        report: resolve(__dirname, 'report.html'),
        login: resolve(__dirname, 'auth/login.html'),
        register: resolve(__dirname, 'auth/register.html'),
        tenantDashboard: resolve(__dirname, 'dashboard/tenant.html'),
        landlordDashboard: resolve(__dirname, 'dashboard/landlord.html'),
        landlordAddListing: resolve(__dirname, 'dashboard/landlord-add.html'),
        landlordEditListing: resolve(__dirname, 'dashboard/landlord-edit.html'),
        landlordUnlocks: resolve(__dirname, 'dashboard/landlord-unlocks.html'),
        tenantSaved: resolve(__dirname, 'dashboard/tenant-saved.html'),
        tenantUnlocked: resolve(__dirname, 'dashboard/tenant-unlocked.html'),
        tenantCompare: resolve(__dirname, 'dashboard/tenant-compare.html'),
        tenantPayments: resolve(__dirname, 'dashboard/tenant-payments.html'),
        payment: resolve(__dirname, 'payment/pay.html'),
        paymentSuccess: resolve(__dirname, 'payment/success.html'),
        paymentProblem: resolve(__dirname, 'payment/problem.html'),
        adminDashboard: resolve(__dirname, 'admin/index.html'),
        adminVerify: resolve(__dirname, 'admin/verify-landlords.html'),
        adminListings: resolve(__dirname, 'admin/listings.html'),
        adminReports: resolve(__dirname, 'admin/reports.html'),
        terms: resolve(__dirname, 'legal/terms.html'),
        privacy: resolve(__dirname, 'legal/privacy.html'),
        cookies: resolve(__dirname, 'legal/cookies.html')
      }
    }
  }
});        landlordUnlocks: resolve(__dirname, 'dashboard/landlord-unlocks.html'),
        tenantSaved: resolve(__dirname, 'dashboard/tenant-saved.html'),
        tenantUnlocked: resolve(__dirname, 'dashboard/tenant-unlocked.html'),
        tenantCompare: resolve(__dirname, 'dashboard/tenant-compare.html'),
        tenantPayments: resolve(__dirname, 'dashboard/tenant-payments.html'),
        payment: resolve(__dirname, 'payment/pay.html'),
        paymentSuccess: resolve(__dirname, 'payment/success.html'),
        paymentProblem: resolve(__dirname, 'payment/problem.html'),
        adminDashboard: resolve(__dirname, 'admin/index.html'),
        adminVerify: resolve(__dirname, 'admin/verify-landlords.html'),
        adminListings: resolve(__dirname, 'admin/listings.html'),
        adminReports: resolve(__dirname, 'admin/reports.html'),
        terms: resolve(__dirname, 'legal/terms.html'),
        privacy: resolve(__dirname, 'legal/privacy.html'),
        cookies: resolve(__dirname, 'legal/cookies.html')
      }
    }
  }
});
