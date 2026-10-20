import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { InvalidTransitionError } from './state-transitions';

interface MinimalResponse {
  status: (code: number) => { json: (body: unknown) => void };
}

@Catch(InvalidTransitionError)
export class InvalidTransitionExceptionFilter implements ExceptionFilter {
  catch(exception: InvalidTransitionError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<MinimalResponse>();
    response.status(409).json({
      statusCode: 409,
      message: exception.message,
      currentState: exception.from,
    });
  }
}
