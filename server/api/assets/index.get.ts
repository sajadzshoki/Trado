import { listAssets } from '../../utils/journal'

export default defineEventHandler(event => listAssets(event))
