import { google } from 'googleapis';
import {NATIONIALGRID_EMAIL} from '../constants'

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function getEmailInfo(auth, Email_id) {
    const gmail = google.gmail({version: 'v1', auth});
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: Email_id,
      format: 'raw'
    });
    const data = res.data
    const paymentInfo = atob(data.raw.split('_')[2])
    const parsedInfo = paymentInfo.replace(/\s/g, ' ').split(" ")[47].replace(/\$/g, "")
    return parsedInfo  
}
  


async function checkforEmail(auth){
    const gmail = google.gmail({version: 'v1', auth})
    const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: '1',
        q: "from:"+NATIONIALGRID_EMAIL 
    })
    const labels = res.data.messages
    if (!labels || labels.length === 0) {
        console.log('No labels found.');
        return;
      }
    labels.forEach((lable) => {
        getEmailInfo(auth, lable.id)
    })
}

async function checknewEmail(auth, CURRENTID){

    const gmail = google.gmail({version: 'v1', auth})
    try{
      const res = await gmail.users.messages.list({
          userId: 'me',
          maxResults: '1',
          q:  "from:"+NATIONIALGRID_EMAIL  
      })
      if(res.length == 0 || res.data.messages == undefined) return;
      const lable = res.data.messages
      if(!lable) {
          console.log('No labels found.');
          return;
      }
      const id = lable[0].id
      if(id !== CURRENTID){ 
        CURRENTID = id;
        const balance = await getEmailInfo(auth, id) 
        if(balance == null) return;
        return {balance: balance, id:id}
      }    
    } catch (err) {
      console.log(err)
    }
}

async function onStart(auth){
  const gmail = google.gmail({version: 'v1', auth})
  const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: '1',
      q: "from:"+NATIONIALGRID_EMAIL 
  })
  if(res.length == 0 || res.data.messages == undefined) return;
  const lable = res.data.messages[0].id
  if(!lable) {
      console.log('No labels found.');
      return;
  }

  return lable;

}

export {checkforEmail, onStart, checknewEmail}