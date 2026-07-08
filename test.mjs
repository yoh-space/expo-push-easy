import { sendFcm } from './dist/index.js'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync('./service-account.json', 'utf-8'))

const result = await sendFcm("dE3hf85TQfi7TdZXFjcaCL:APA91bEXaLDwX-wdJWlLg7bfKbEph9Tfr7wHxQ9AuSNThuXbL2jwBor68aQlgBpa1DsgvJ6P6lj9LYcEMg3RknjGiYKdvlg1UHJ2fioWId9hu_OpbvaMXoM", {
  title: 'Test',
  body: 'From my library!',
}, sa)

console.log(JSON.stringify(result, null, 2))
