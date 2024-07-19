using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace SimpleAPI
{
    [ApiController]
    [Route("api/[controller]")]
     public class ValuesController :Controller
    {
        [HttpGet("list")]
        // GET: api/values
        public IEnumerable<string> Get()
        {
            return new string[] { "valuell1f", "valuekj2o" };
        }
       [HttpGet("lis")]
        // GET: api/values/5
        public string Get(int id)
        {
            return "sandeep";
        }

        
    }
}