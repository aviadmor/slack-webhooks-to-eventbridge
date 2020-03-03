import { APIGatewayProxyEvent } from 'aws-lambda'
import querystring from 'querystring'

interface INotificationRepository {
  send: (message: Object) => Promise<any>
}

// The event we are sending to the EventBridge event bus is similar to APIGatewayProxyEventWithoutBody, body can be string, null or object.
// This is because we are parsing the request body if the request content type is application/json or application/x-www-form-urlencoded.
// We are also reusing the APIGatewayProxyEvent interface, but we need to remove body property
type APIGatewayProxyEventWithoutBody = Omit<APIGatewayProxyEvent, 'body'>
// And then extend the interface with a new type for a body property
interface IEvent extends APIGatewayProxyEventWithoutBody {
  body: string | null | {
    [key: string]: any
  }
}

export async function sendWebhookEvent(event: APIGatewayProxyEvent, notification: INotificationRepository) {
  try {
    const eventCopy: IEvent = Object.assign({}, event)
    let body = event.body

    if (body && event.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf8')
    }

    if (body && /^application\/json($|;)/.test(eventCopy.headers['Content-Type'])) {
      eventCopy.body = JSON.parse(body)
    }

    if (body && /^application\/x-www-form-urlencoded($|;)/.test(eventCopy.headers['Content-Type'])) {
      eventCopy.body = querystring.parse(body)
    }

    if (eventCopy.body && typeof eventCopy.body === 'object' && eventCopy.body.type === 'url_verification') {
      return eventCopy.body.challenge
    }

    await notification.send(eventCopy)

    return null
  } catch (err) {
    await notification.send(event)
    return null
  }
}