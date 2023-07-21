import {checkforEmail as checkforEmailEversource, 
  onStart as onStartEversource,
  checknewEmail as checknewEmailEversource,
} from './modules/eversource.js'

import {checkforEmail as checkforEmailnationalGrid, 
  onStart as onStartnationalGrid,
  checknewEmail as checknewEmailnationalGrid,
} from './modules/nationalGrid.js'



import path from 'path'
import process from 'process'
import { google } from 'googleapis';
import express from 'express';
import bodyParser from 'body-parser'
import {OAuth2Client} from 'google-auth-library';
import cors from 'cors';
import twilio from 'twilio';
import dotenv from 'dotenv/config';
import { validateExpressRequest } from 'twilio/lib/webhooks/webhooks.js';
import axios from 'axios';
    

let USERINFO;
let USERSET;
let serverCredentials;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

async function START_All_Utilities() { //create new OAuth2Client for each user out of tokes stored in db

    for(let [key, value] of USERSET.entries()) {
      console.log(value)
      if(value.initialized) {

        if(value.toDelete == true) return

        const oAuth2Client = new OAuth2Client(
          serverCredentials.client_id,
          serverCredentials.client_secret,
          serverCredentials.redirect_uris[0]
        );
        
        const userID = value.usersID

        axios.get(process.env.REQUEST_URL+'/startALL/'+userID, {
          headers: {
            Authorization: `Bearer ${process.env.API_KEY}`
          }
        }).then((response) => {

            console.log(response.data)
            const userAuth = response.data.userAuth
            const emailIds = response.data.emailIds

              
            const credentials = {
              refresh_token: userAuth.refresh_token,
              scope: userAuth.scope,
              token_type: userAuth.token_type,
              access_token: userAuth.access_token,
              expiry_date: userAuth.expiry_date
            }
            
            oAuth2Client.setCredentials(credentials)

            let temp = value

            temp.OAuth2Client = oAuth2Client
            temp.electric = emailIds.electric
            temp.gas = emailIds.gas

            // console.log("temp", temp ,temp.OAuth2Client, temp.electric, temp.gas)
            USERSET.set(key, temp) 
        })
      
    }
  }
}

async function checkforNewUsers() {


  const axiosInstance = axios.create({
    headers: {
      Authorization: `Bearer ${process.env.API_KEY}`
    }
  });

  axios.all([
    axiosInstance.get(process.env.REQUEST_URL+'/findNewUsers'),
    axiosInstance.get(process.env.REQUEST_URL+'/usersToDelete'),
    axiosInstance.get(process.env.REQUEST_URL+'/usersToUpdate')
  ]).then(axios.spread((newUsers, deleteUsers, toUpdate ) => {
    // console.log(newUsers, deleteUsers, toUpdate)

    const newUserData = newUsers.data
    if(newUserData.length > 0) {
      console.log(newUserData)
      console.log("new users")
      newUserData.forEach(user =>{
        initialize_Utility(user)
      })
    }
    
    const deleteUserData = deleteUsers.data
    console.log(deleteUserData)
    if(deleteUserData != "no users to delete" && deleteUserData.length > 0) {
      deleteUserData.forEach(async user =>{
        USERSET.delete(user.usersID)
      })
    }

    const toUpdateData = toUpdate.data;
    if(toUpdateData != "no new users" && toUpdateData.length > 0) {
      console.log(toUpdateData)
      toUpdateData.forEach(async user =>{
        console.log(user.usersID)
        user.OAuth2Client = USERSET.get(user.usersID).OAuth2Client
        user.electric = USERSET.get(user.usersID).electric
        user.gas = USERSET.get(user.usersID).gas
        user.toUpdate = false
        USERSET.set(user.usersID, user)
      })
    }

  }))



}

async function initialize_Utility(e) {
      console.log(e.usersID)
      
      const oAuth2Client = new OAuth2Client(
        serverCredentials.client_id,
        serverCredentials.client_secret,
        serverCredentials.redirect_uris[0]
      );

      axios.get(process.env.REQUEST_URL+'/tokenInfo/' + e.usersID, {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`
        }
      }).then(async (response) => {
         console.log(response.data)
         const userAuth = response.data

         const credentials = {
          access_token: userAuth.access_token,
          refresh_token: userAuth.refresh_token,
          scope: userAuth.scope,
          token_type: userAuth.token_type,
          expiry_date: userAuth.expiry_date}
        
          oAuth2Client.setCredentials(credentials)
    
          // Grab newest email from both catagories
          const eversource = await onStartEversource(oAuth2Client)
          const nationalgrid = await onStartnationalGrid(oAuth2Client)
    
          axios.post(process.env.REQUEST_URL+'/newEmails/' + e.usersID,{eversource: eversource, nationalgrid: nationalgrid},
           { headers: {
              Authorization: `Bearer ${process.env.API_KEY}`
            }
          }).then((response) => {
            console.log(response.data)
          })
    
          axios.post(process.env.REQUEST_URL+'/userisInitalized/' + e.usersID,{} ,{
            headers: {
              Authorization: `Bearer ${process.env.API_KEY}`
            }
          }).then((response) => {
              console.log(response.data)
          })
    
    
          e.OAuth2Client = oAuth2Client
          e.electric = eversource
          e.gas = nationalgrid
          e.initialized = true
    
          USERSET.set(e.usersID, e)   

      })
}



async function check_All_Utilities() {
  for(const [key, e] of  USERSET.entries()) {
    if(e.initialized) {
      console.log(e.OAuth2Client)
      const usersID = e.usersID

      let x = Date.now()
      if(e.electric == null ) return
      const ESpayment = await checknewEmailEversource(e.OAuth2Client, e.electric)
      const NGpayment = await checknewEmailnationalGrid(e.OAuth2Client, e.gas)
      

      console.log(Date.now()-x)
      console.log("we have info?" + JSON.stringify(NGpayment) + " " + JSON.stringify(ESpayment) + " ")
      if(NGpayment !== undefined && ESpayment !== undefined) {
        e.electric = ESpayment.id
        e.gas = NGpayment.id
        
        axios.post(process.env.REQUEST_URL+'/newEmails/' + e.usersID, {gas: NGpayment.id, electric: ESpayment.id},
        {headers: {
          Authorization: `Bearer ${process.env.API_KEY}`
        }
        }).then((response) => {
            console.log(response.data)
            requestMoney(e.phoneNumber, NGpayment.balance + ESpayment.balance, e.roommatesNumbs)

        })

      }
      else if (NGpayment !== undefined && ESpayment === undefined) {
        e.gas = NGpayment.id
    
        axios.post(process.env.REQUEST_URL+'/newEmails/' + e.usersID, {gas: NGpayment.id, electric: ESpayment.id},
          {headers: {
            Authorization: `Bearer ${process.env.API_KEY}`
          }
        }).then((response) => {
            console.log(response.data)
            requestMoney(e.phoneNumber, NGpayment.balance, e.roommatesNumbs)
        })

      }
      else if (NGpayment === undefined && ESpayment !== undefined) {        
        e.electric = ESpayment.id
       
        axios.post(process.env.REQUEST_URL+'/newEmails/' + e.usersID, {gas: NGpayment.id, electric: ESpayment.id},
          { headers: {
            Authorization: `Bearer ${process.env.API_KEY}`
          }
        }).then((response) => {
            console.log(response.data)
            requestMoney(e.phoneNumber, ESpayment.balance, e.roommatesNumbs)
        })
      }
    }
  }
}

function requestMoney(usersPhoneNumber, total, roommates){
  console.log("sending text for:" )
  const perPerson = Math.ceil(total / roommates.length)

  client.message.create({body:`Total Utiltiies is ${total} with a amount of ${perPerson} per person`, from: '+18339653250',
  to: usersPhoneNumber}).then(message => console.log(message.sid));

  roommates.forEach(e => {
      client.messages
        .create({
          body: `Total Utiltiies is ${total} with a amount of ${perPerson} per person`,
          from: '+18339653250',
          to: e
        })
        .then(message => console.log(message.sid));
  })
}

const corsOptions = {
  origin: '*',
  credentials: true,            //access-control-allow-credentials:true
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

  const app = express();

  app.use(bodyParser.json()); // <--- Here
  app.use(cors(corsOptions))

  const PORT = process.env.PORT || 8080;

  app.listen(PORT, async () => {
      console.log('listening on ' + PORT)
      console.log("test")
      serverCredentials = JSON.parse(process.env.KEY)

      axios.get(process.env.REQUEST_URL+'/users', {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`
        }
      }).then((response) => {
        console.log(response.data)
        USERINFO = response.data
        USERSET = new Map(USERINFO.map(info => [info.usersID, info]))
        START_All_Utilities()
        .then(() => {
          setInterval(() => {
              check_All_Utilities()
              try{
                checkforNewUsers()
                console.log("t")
              } catch (e) {
                console.log(e)
              }
            }
          , 6000)
        })
      })

    })