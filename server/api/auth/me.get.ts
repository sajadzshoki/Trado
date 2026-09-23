import { currentAccount } from '../../utils/journal'

export default defineEventHandler(event => currentAccount(event))
