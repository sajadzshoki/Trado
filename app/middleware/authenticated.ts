export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (loggedIn.value) return
  const localePath = useLocalePath()
  return navigateTo({
    path: localePath('/login'),
    query: to.fullPath && to.fullPath !== localePath('/') ? { redirect: to.fullPath } : undefined,
  })
})
