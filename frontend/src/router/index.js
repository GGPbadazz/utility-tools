import { createRouter, createWebHistory } from 'vue-router'
import SinglePageApplicationForm from '../components/SinglePageApplicationForm.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/applications'
    },
    {
      path: '/new-application',
      name: 'new-application',
      component: SinglePageApplicationForm
    },
    {
      path: '/quick-submit',
      name: 'quick-submit',
      component: () => import('../components/QuickSubmitForm.vue')
    },
    {
      path: '/applications',
      name: 'applications',
      component: () => import('../views/ApplicationList.vue')
    },
    {
      path: '/applications/:id',
      name: 'application-detail',
      component: () => import('../views/ApplicationDetail.vue')
    },
    {
      path: '/analyst',
      name: 'analyst-dashboard',
      component: () => import('../views/AnalystDashboard.vue')
    },
    {
      path: '/reports',
      name: 'reports-center',
      component: () => import('../components/ReportsCenter.vue')
    },
    {
      path: '/settings',
      name: 'system-settings',
      component: () => import('../views/SystemSettings.vue')
    }
  ]
})

export default router
