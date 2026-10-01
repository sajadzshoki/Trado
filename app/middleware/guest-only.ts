export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) return
  return navigateTo(useLocalePath()('/'))
})
