/**
 * Creating a form action to handle form submission
 * Extracting the data from formData.
    Validating the types with Zod.
    Converting the amount to cents.
    Passing the variables to your SQL query.
    Calling revalidatePath to clear the client cache and make a new server request.
    Calling redirect to redirect the user to the invoice's page.
 */


'use server';

import { z } from 'zod'; //TypeScript-first validation library
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache'; // clear this cache and trigger a new request to the server
import {redirect} from 'next/navigation'; //  redirect the user back to the /dashboard/invoices page.
import {signIn} from '@/auth'
import { AuthError } from 'next-auth';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  });
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });

// creating a server func to handle new invoice creation
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };
   
export async function createInvoice(prevState: State, formData: FormData) {
    const  validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
    }
    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = 100 * amount;
    const date = new Date().toISOString().split('T')[0];
    try{
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
        return {
          message: 'Database Error: Failed to Create Invoice.',
        };
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
// update invoice with id
export async function updateInvoice(id: string, prevState:State, formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
    }
    const {amount, customerId, status} = validatedFields.data;
    const amountInCents = amount * 100;
 
  try{
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    return {
        message: 'Database Error: Failed to Update Invoice.',
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// delete invoice with id
export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    }   catch (error) {
        return {
            message: 'Database Error: Failed to Delete Invoice.',
        };
    }
    revalidatePath('/dashboard/invoices');
}

//authenticating users
export async function authenticate(
    prevState: string | State | undefined,
    formData: FormData,
) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return {message: 'Invalid credentials.'};
          default:
            return {message: 'Something went wrong.'};
        }
      }
      throw error;
    }
  }