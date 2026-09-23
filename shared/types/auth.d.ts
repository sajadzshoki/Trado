declare module '#auth-utils' {
  interface User {
    id: string
    phone: string
    displayName: string | null
    locale: 'en' | 'fa'
    displayCurrency: 'USD' | 'TOMAN'
  }

  interface UserSession {
    loggedInAt?: number
  }
}

export {}
