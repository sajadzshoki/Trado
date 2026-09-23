import { listTrades } from '../../utils/journal'

export default defineEventHandler(event => listTrades(event))
